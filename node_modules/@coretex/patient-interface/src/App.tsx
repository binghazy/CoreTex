import { useEffect, useMemo, useState } from "react";
import coretexLogo from "./assets/coretex-logo.svg";
import healthVisual1 from "./assets/health-visual-1.svg";
import healthVisual2 from "./assets/health-visual-2.svg";
import healthVisual3 from "./assets/health-visual-3.svg";

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() ||
  "http://localhost:4000";
const DOCTOR_PORTAL_URL =
  (import.meta.env.VITE_DOCTOR_PORTAL_URL as string | undefined)?.trim() ||
  "http://localhost:5173";

function toRequestErrorMessage(caught: unknown, fallback: string) {
  if (
    caught instanceof TypeError &&
    caught.message.toLowerCase().includes("failed to fetch")
  ) {
    return `Cannot reach API server at ${API_BASE}. Start the backend with "npm run dev:api".`;
  }
  if (caught instanceof Error && caught.message.trim()) {
    return caught.message;
  }
  return fallback;
}

interface Schedule {
  medication: string;
  times: string[];
  note?: string;
}

interface Analysis {
  isSafe: boolean;
  interactions: Array<{
    medications: [string, string];
    severity: "minor" | "moderate" | "major" | "contraindicated";
    reason: string;
    canSeparateBySchedule: boolean;
    minHoursApart?: number;
  }>;
  recommendations: Array<{
    type: "keep_and_separate" | "replace_medication" | "avoid_combination";
    title: string;
    details: string;
  }>;
  schedule: Schedule[];
}

interface PatientMessage {
  text: string;
  timestamp: string;
  sender?: "patient" | "doctor";
}

interface PatientData {
  id: string;
  name: string;
  condition: string | null;
  analysis: Analysis | null;
  reports: PatientMessage[];
  feedback: PatientMessage[];
}

function PatientLogo() {
  return (
    <img src={coretexLogo} alt="CoreTex logo" className="patient-top-logo" />
  );
}

function PatientVisualGallery() {
  return (
    <section
      className="patient-visual-gallery"
      aria-label="Patient support visuals"
    >
      <img src={healthVisual1} alt="Health monitoring visual" />
      <img src={healthVisual2} alt="Medication management visual" />
      <img src={healthVisual3} alt="Care team communication visual" />
    </section>
  );
}

const landingHighlights = [
  {
    value: "24/7",
    title: "Always-On Reporting",
    detail:
      "Patients can report symptoms any time while doctors review updates from one shared workspace.",
  },
  {
    value: "<2 min",
    title: "Fast Intake",
    detail:
      "Structured symptom submission keeps handoff clear and avoids long back-and-forth.",
  },
  {
    value: "1 view",
    title: "Unified Context",
    detail:
      "Symptoms, plan details, and patient-doctor messages stay connected in one treatment journey.",
  },
];

const landingWorkflow = [
  {
    step: "01",
    title: "Patient Reports Symptoms",
    detail:
      "Patients submit symptoms quickly through a guided interface built for clarity.",
  },
  {
    step: "02",
    title: "Doctor Reviews Context",
    detail:
      "Doctors receive the latest report and patient history in one focused dashboard.",
  },
  {
    step: "03",
    title: "Treatment Plan is Shared",
    detail:
      "A clear medication timeline is generated so patients know what to take and when.",
  },
  {
    step: "04",
    title: "Care Continues in Messages",
    detail:
      "Both sides keep communicating in-app when symptoms evolve or adjustments are needed.",
  },
];

export function App() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string>("");
  const [showPatientEntry, setShowPatientEntry] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [symptom, setSymptom] = useState("");
  const [symptomSubmitted, setSymptomSubmitted] = useState(false);

  const [patientData, setPatientData] = useState<PatientData | null>(null);

  const [messageInput, setMessageInput] = useState("");
  const [messageSubmitted, setMessageSubmitted] = useState(false);

  useEffect(() => {
    const storedId = sessionStorage.getItem("patientId");
    const storedName = sessionStorage.getItem("patientName");
    if (storedId && storedName) {
      setPatientId(storedId);
      setPatientName(storedName);
      void fetchPatientData(storedId);
    }
  }, []);

  useEffect(() => {
    if (!patientId) return;

    void fetchPatientData(patientId);
    const interval = setInterval(() => {
      void fetchPatientData(patientId);
    }, 3000);

    return () => clearInterval(interval);
  }, [patientId]);

  const fetchPatientData = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/patients/${id}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = (await res.json()) as PatientData;

      if (data && data.id && data.name) {
        setPatientData({
          ...data,
          reports: data.reports ?? [],
          feedback: data.feedback ?? [],
        });

        // If patient already submitted reports or has a condition, skip symptom form.
        if ((data.reports?.length ?? 0) > 0 || Boolean(data.condition)) {
          setSymptomSubmitted(true);
        }
      }
    } catch (caught) {
      console.error("Fetch patient data failed:", caught);
    }
  };

  const handleSignup = async () => {
    if (!patientName.trim()) {
      setError("Please enter your name");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: patientName }),
      });
      if (!res.ok) throw new Error("Signup failed");

      const created = (await res.json()) as { id: string; name: string };
      sessionStorage.setItem("patientId", created.id);
      sessionStorage.setItem("patientName", created.name);

      setPatientId(created.id);
      setPatientData({
        id: created.id,
        name: created.name,
        condition: null,
        analysis: null,
        reports: [],
        feedback: [],
      });
    } catch (caught) {
      setError(toRequestErrorMessage(caught, "Signup failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitSymptom = async () => {
    if (!symptom.trim() || !patientId) return;

    setError("");
    try {
      const res = await fetch(`${API_BASE}/patients/${patientId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: symptom }),
      });
      if (!res.ok) throw new Error("Failed to submit symptoms");

      setSymptom("");
      setSymptomSubmitted(true);
      await fetchPatientData(patientId);
    } catch (caught) {
      setError(toRequestErrorMessage(caught, "Failed to submit symptoms"));
    }
  };

  const handleSendMessageToDoctor = async () => {
    if (!messageInput.trim() || !patientId) return;

    setError("");
    try {
      const res = await fetch(`${API_BASE}/patients/${patientId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: messageInput }),
      });
      if (!res.ok) throw new Error("Failed to send message");

      setMessageInput("");
      setMessageSubmitted(true);
      setTimeout(() => setMessageSubmitted(false), 2500);
      await fetchPatientData(patientId);
    } catch (caught) {
      setError(toRequestErrorMessage(caught, "Failed to send message"));
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    setPatientId(null);
    setPatientName("");
    setShowPatientEntry(false);
    setPatientData(null);
    setSymptom("");
    setSymptomSubmitted(false);
    setMessageInput("");
    setMessageSubmitted(false);
    setError("");
  };

  const openDoctorPortal = () => {
    window.location.assign(DOCTOR_PORTAL_URL);
  };

  const hasCondition = Boolean(patientData?.condition);
  const hasAnalysis = Boolean(patientData?.analysis);
  const hasPlan = hasCondition && hasAnalysis;
  const journeyStep = !symptomSubmitted
    ? 1
    : !hasCondition
      ? 2
      : !hasPlan
        ? 3
        : 4;

  const scheduleTimeline = useMemo(() => {
    const schedule = patientData?.analysis?.schedule ?? [];
    return schedule
      .flatMap((slot) =>
        slot.times.map((time) => ({
          time,
          medication: slot.medication,
          note: slot.note,
        })),
      )
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [patientData?.analysis?.schedule]);

  const messageHistory = patientData?.feedback ?? [];
  const patientSentMessageCount = messageHistory.filter(
    (message) => message.sender !== "doctor",
  ).length;
  const nextDose = scheduleTimeline[0]
    ? `${scheduleTimeline[0].time} • ${scheduleTimeline[0].medication}`
    : "Pending";
  const planStatus = hasPlan ? "Active" : "Pending";

  const journeyBar = (
    <section className="journey-bar">
      {["Symptoms", "Doctor Review", "Plan Build", "Active Treatment"].map(
        (label, index) => (
          <div
            key={label}
            className={`journey-step ${journeyStep >= index + 1 ? "active" : ""}`}
          >
            <span className="journey-dot">{index + 1}</span>
            <p>{label}</p>
          </div>
        ),
      )}
    </section>
  );

  const patientPageEnhancements = (
    <>
      <PatientVisualGallery />
    </>
  );

  const messageCard = (
    <section className="card">
      <h2>Message Your Doctor</h2>
      <p className="form-description">
        Send a new message anytime if symptoms change or you need plan
        adjustments.
      </p>

      <textarea
        value={messageInput}
        onChange={(e) => setMessageInput(e.target.value)}
        placeholder="Example: I started feeling dizzy after the evening dose. Can we adjust timing?"
        rows={4}
        className="symptoms-textarea"
      />

      <button
        className="btn btn-primary"
        onClick={handleSendMessageToDoctor}
        disabled={!messageInput.trim()}
      >
        Send Message to Doctor
      </button>

      {messageSubmitted && (
        <p
          className="form-description"
          style={{ color: "#0284c7", marginTop: "12px" }}
        >
          Message sent.
        </p>
      )}

      {messageHistory.length > 0 && (
        <div className="submitted-symptoms">
          <h3>Conversation</h3>
          <div className="report-list">
            {messageHistory
              .slice()
              .reverse()
              .map((item, idx) => {
                const isDoctorMessage = item.sender === "doctor";
                return (
                  <div
                    key={`${item.timestamp}-${idx}`}
                    className={`report-item ${isDoctorMessage ? "report-item-doctor" : "report-item-patient"}`}
                  >
                    <small>
                      {isDoctorMessage ? "Doctor" : "You"} •{" "}
                      {new Date(item.timestamp).toLocaleString()}
                    </small>
                    <p>{item.text}</p>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </section>
  );

  if (!patientId) {
    if (!showPatientEntry) {
      return (
        <main className="landing-shell">
          <div className="landing-glow landing-glow-left" aria-hidden></div>
          <div className="landing-glow landing-glow-right" aria-hidden></div>
          <section className="landing-card landing-site">
            <nav className="landing-nav">
              <a
                href="#home"
                className="landing-brand-link"
                aria-label="CoreTex home"
              >
                <img
                  src={coretexLogo}
                  alt="CoreTex logo"
                  className="landing-brand-logo"
                />
              </a>

              <div className="landing-nav-links">
                <a href="#home" className="landing-nav-link">
                  Home
                </a>
                <a href="#workflow" className="landing-nav-link">
                  Workflow
                </a>
                <a href="#about" className="landing-nav-link">
                  About Us
                </a>
                <a href="#portals" className="landing-nav-link">
                  Portals
                </a>
              </div>
            </nav>

            <section id="home" className="landing-hero">
              <p className="landing-kicker">CoreTex Integrated Care Platform</p>
              <h1>Connected Care for Patients and Doctors</h1>
              <p className="landing-subtitle">
                CoreTex brings reporting, review, treatment planning, and
                patient-doctor messaging into one smooth experience that helps
                teams move faster with better clarity.
              </p>
              <a href="#portals" className="landing-scroll-link">
                Explore Portals <span aria-hidden>↓</span>
              </a>
            </section>

            <section className="landing-highlights" aria-label="Platform highlights">
              {landingHighlights.map((highlight) => (
                <article
                  key={highlight.title}
                  className="landing-highlight-card"
                >
                  <p className="landing-highlight-value">{highlight.value}</p>
                  <h3>{highlight.title}</h3>
                  <p>{highlight.detail}</p>
                </article>
              ))}
            </section>

            <section id="portals" className="landing-actions">
              <button
                type="button"
                className="landing-choice landing-choice-patient"
                onClick={() => setShowPatientEntry(true)}
              >
                <span className="landing-choice-tag">For Patients</span>
                <strong>Patient Portal</strong>
                <p>
                  Report symptoms, view your treatment plan, and stay in touch
                  with your doctor.
                </p>
              </button>
              <button
                type="button"
                className="landing-choice landing-choice-doctor"
                onClick={openDoctorPortal}
              >
                <span className="landing-choice-tag">For Doctors</span>
                <strong>Doctor Portal</strong>
                <p>
                  Review patient updates, assign treatment plans, and
                  coordinate care decisions.
                </p>
              </button>
            </section>

            <section id="workflow" className="landing-workflow">
              <div className="landing-workflow-head">
                <p className="landing-kicker">How It Works</p>
                <h2>One Connected Flow From Symptoms to Treatment</h2>
              </div>
              <div className="landing-workflow-grid">
                {landingWorkflow.map((item) => (
                  <article key={item.step} className="landing-workflow-card">
                    <p className="landing-workflow-step">{item.step}</p>
                    <h3>{item.title}</h3>
                    <p>{item.detail}</p>
                  </article>
                ))}
              </div>
            </section>

            <footer id="about" className="landing-footer">
              <h2>About Us</h2>
              <p>
                We built CoreTex to make collaboration between care teams and
                patients simple, transparent, and actionable at every stage.
              </p>
              <div className="landing-footer-grid">
                <article className="landing-footer-card">
                  <h3>Patient First</h3>
                  <p>
                    Patients can quickly share symptoms, view plans, and receive
                    clear next steps without confusion.
                  </p>
                </article>
                <article className="landing-footer-card">
                  <h3>Doctor Focused</h3>
                  <p>
                    Doctors get a streamlined workspace to assess reports and
                    prescribe with confidence.
                  </p>
                </article>
                <article className="landing-footer-card">
                  <h3>Unified Workflow</h3>
                  <p>
                    Both sides stay aligned in one connected system with faster
                    communication and fewer gaps.
                  </p>
                </article>
              </div>
            </footer>
          </section>
        </main>
      );
    }

    return (
      <main className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <PatientLogo />
            <p className="auth-subtitle">Patient Portal</p>
          </div>

          <div className="auth-form">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setShowPatientEntry(false);
                setError("");
              }}
            >
              Back
            </button>
            <h2>Welcome</h2>
            <p className="form-description">Tell us your name to get started</p>
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="John Doe"
                onKeyDown={(e) => e.key === "Enter" && void handleSignup()}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSignup}
              disabled={isLoading}
            >
              {isLoading ? "Creating Account..." : "Get Started"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!symptomSubmitted) {
    return (
      <main className="patient-page">
        <header className="patient-header">
          <div className="header-content">
            <div>
              <PatientLogo />
              <h1>Tell Us Your Symptoms</h1>
              <p className="subhead">Welcome, {patientName}</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {journeyBar}
        {patientPageEnhancements}

        <section className="card">
          <h2>Describe Your Symptoms</h2>
          <p className="form-description">
            Your doctor will review this and create your treatment plan.
          </p>
          {error && <div className="error-message">{error}</div>}

          <textarea
            value={symptom}
            onChange={(e) => setSymptom(e.target.value)}
            placeholder="Example: I have headache, fever, and body aches for 2 days."
            rows={6}
            className="symptoms-textarea"
          />

          <button
            className="btn btn-primary"
            onClick={handleSubmitSymptom}
            disabled={!symptom.trim()}
          >
            Submit Symptoms
          </button>
        </section>
      </main>
    );
  }

  if (!hasCondition) {
    return (
      <main className="patient-page">
        <header className="patient-header">
          <div className="header-content">
            <div>
              <PatientLogo />
              <h1>Your Care Team is Working</h1>
              <p className="subhead">Welcome, {patientName}</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {journeyBar}
        {patientPageEnhancements}

        <section className="card">
          <h2>Waiting for Doctor Review</h2>
          <div className="waiting-container">
            <div className="spinner"></div>
            <p className="waiting-text">
              Your symptoms were received. Your doctor is preparing your plan.
            </p>
            <p className="waiting-subtext">This page updates automatically.</p>
          </div>

          <div className="submitted-symptoms">
            <h3>Your Submitted Symptoms</h3>
            <div className="report-list">
              {(patientData?.reports ?? []).map((report, idx) => (
                <div key={`${report.timestamp}-${idx}`} className="report-item">
                  <small>{new Date(report.timestamp).toLocaleString()}</small>
                  <p>{report.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {messageCard}
      </main>
    );
  }

  if (!hasPlan) {
    return (
      <main className="patient-page">
        <header className="patient-header">
          <div className="header-content">
            <div>
              <PatientLogo />
              <h1>Your Treatment Plan</h1>
              <p className="subhead">
                Treatment plan assigned. Loading medication details...
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {journeyBar}
        {patientPageEnhancements}

        <section className="card">
          <div className="waiting-container">
            <div className="spinner"></div>
            <p className="waiting-text">Fetching your medication plan.</p>
            <p className="waiting-subtext">
              This page will update automatically.
            </p>
          </div>
        </section>

        {messageCard}
      </main>
    );
  }

  return (
    <main className="patient-page">
      <header className="patient-header">
        <div className="header-content">
          <div>
            <PatientLogo />
            <h1>Your Treatment Plan</h1>
            <p className="subhead">Follow your medication timeline below.</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {journeyBar}
      {patientPageEnhancements}

      {error && <div className="error-message">{error}</div>}

      <section className="patient-stat-grid">
        <article className="patient-stat-card">
          <p className="stat-label">Today&apos;s Doses</p>
          <p className="stat-value">{scheduleTimeline.length}</p>
        </article>
        <article className="patient-stat-card">
          <p className="stat-label">Next Dose</p>
          <p className="stat-value stat-value-sm">{nextDose}</p>
        </article>
        <article className="patient-stat-card">
          <p className="stat-label">Plan Status</p>
          <p className="stat-value stat-value-sm">{planStatus}</p>
        </article>
        <article className="patient-stat-card">
          <p className="stat-label">Messages Sent</p>
          <p className="stat-value">{patientSentMessageCount}</p>
        </article>
      </section>

      <section className="card">
        <h2>Your Medication Timeline</h2>
        <div className="timeline">
          {scheduleTimeline.map((item, index) => (
            <div
              key={`${item.medication}-${item.time}-${index}`}
              className="timeline-item"
            >
              <div className="timeline-time">{item.time}</div>
              <div className="timeline-content">
                <p className="med">{item.medication}</p>
                {item.note && <p className="instruction">{item.note}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {messageCard}
    </main>
  );
}
