import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:4000";

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

const severityLabels: Record<
  Analysis["interactions"][number]["severity"],
  string
> = {
  minor: "Minor",
  moderate: "Moderate",
  major: "Major",
  contraindicated: "Contraindicated",
};

export function App() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string>("");
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
      setError(caught instanceof Error ? caught.message : "Signup failed");
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
      setError(
        caught instanceof Error ? caught.message : "Failed to submit symptoms",
      );
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
      setError(
        caught instanceof Error ? caught.message : "Failed to send message",
      );
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    setPatientId(null);
    setPatientName("");
    setPatientData(null);
    setSymptom("");
    setSymptomSubmitted(false);
    setMessageInput("");
    setMessageSubmitted(false);
    setError("");
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

  const guidance = useMemo(() => {
    if (!patientData?.analysis) {
      return "Your treatment plan is being prepared.";
    }
    if (
      patientData.analysis.isSafe &&
      patientData.analysis.interactions.length === 0
    ) {
      return "Your treatment plan looks good. Follow the schedule and report any side effects.";
    }
    if (patientData.analysis.interactions.length > 0) {
      return "Your medications require careful timing. Follow the schedule strictly.";
    }
    return "Review this plan with your doctor if you have questions.";
  }, [patientData?.analysis]);

  const messageHistory = patientData?.feedback ?? [];
  const patientSentMessageCount = messageHistory.filter(
    (message) => message.sender !== "doctor",
  ).length;
  const nextDose = scheduleTimeline[0]
    ? `${scheduleTimeline[0].time} • ${scheduleTimeline[0].medication}`
    : "Pending";

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
    return (
      <main className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>CoreTex</h1>
            <p className="auth-subtitle">Patient Portal</p>
          </div>

          <div className="auth-form">
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
              <p className="eyebrow">CoreTex</p>
              <h1>Tell Us Your Symptoms</h1>
              <p className="subhead">Welcome, {patientName}</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {journeyBar}

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
              <p className="eyebrow">CoreTex</p>
              <h1>Your Care Team is Working</h1>
              <p className="subhead">Welcome, {patientName}</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {journeyBar}

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
              <p className="eyebrow">CoreTex</p>
              <h1>Your Treatment Plan</h1>
              <p className="subhead">
                Condition assigned. Loading medication details...
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {journeyBar}

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
            <p className="eyebrow">CoreTex</p>
            <h1>Your Treatment Plan</h1>
            <p className="subhead">
              Condition: <strong>{patientData?.condition}</strong>
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {journeyBar}

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
          <p className="stat-label">Safety Alerts</p>
          <p className="stat-value">
            {patientData?.analysis?.interactions.length ?? 0}
          </p>
        </article>
        <article className="patient-stat-card">
          <p className="stat-label">Messages Sent</p>
          <p className="stat-value">{patientSentMessageCount}</p>
        </article>
      </section>

      <section className="card">
        <h2>Condition Summary</h2>
        <div className="condition-box">
          <p className="condition-text">{patientData?.condition}</p>
        </div>
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

      <section className="card">
        <h2>Safety Information Run With AI</h2>
        <div
          className={`guidance-box ${patientData?.analysis?.isSafe ? "safe" : "warning"}`}
        >
          <p className="guidance">{guidance}</p>
        </div>

        {(patientData?.analysis?.interactions.length ?? 0) > 0 && (
          <div className="interactions-section">
            <h3>Drug Interactions</h3>
            <div className="interaction-grid">
              {patientData?.analysis?.interactions.map((interaction, index) => (
                <article
                  key={`${interaction.medications.join("-")}-${index}`}
                  className={`interaction-card severity-${interaction.severity}`}
                >
                  <p className="badge">
                    {severityLabels[interaction.severity]}
                  </p>
                  <p className="med">{interaction.medications.join(" + ")}</p>
                  <p className="reason">{interaction.reason}</p>
                  {interaction.canSeparateBySchedule &&
                    interaction.minHoursApart && (
                      <p className="instruction">
                        Separate by at least {interaction.minHoursApart} hours.
                      </p>
                    )}
                </article>
              ))}
            </div>
          </div>
        )}

        {(patientData?.analysis?.recommendations.length ?? 0) > 0 && (
          <div className="recommendation">
            <h3>Care Team Recommendations</h3>
            <ul>
              {patientData?.analysis?.recommendations.map((rec, index) => (
                <li key={`${rec.title}-${index}`}>
                  <strong>{rec.title}</strong>
                  <p>{rec.details}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {messageCard}
    </main>
  );
}
