import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
const API_BASE = "http://localhost:4000";
const countPatientMessages = (feedback) =>
  (feedback ?? []).filter((message) => message.sender !== "doctor").length;
export function App() {
  // Auth state
  const [doctorToken, setDoctorToken] = useState(() =>
    localStorage.getItem("doctorToken"),
  );
  const [loginName, setLoginName] = useState("Ahmed Mohamed");
  const [loginPassword, setLoginPassword] = useState("0000");
  // Patient management
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  // AI Chat panel
  const [aiChat, setAiChat] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef(null);
  // Condition & medication assignment
  const [conditionInput, setConditionInput] = useState("");
  const [medications, setMedications] = useState([
    { name: "", dose: "", frequencyPerDay: 1 },
    { name: "", dose: "", frequencyPerDay: 1 },
  ]);
  const [settingCondition, setSettingCondition] = useState(false);
  const [editingConditionId, setEditingConditionId] = useState(null);
  const [doctorReplyInput, setDoctorReplyInput] = useState("");
  const [sendingDoctorReply, setSendingDoctorReply] = useState(false);
  // Auto-scroll AI chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [aiChat]);
  // Fetch patients when doctor logs in (token exists)
  useEffect(() => {
    if (doctorToken) {
      fetchPatients(doctorToken);
    }
  }, [doctorToken]);
  useEffect(() => {
    if (!doctorToken) return;
    const interval = setInterval(() => {
      void fetchPatients(doctorToken);
    }, 4000);
    return () => clearInterval(interval);
  }, [doctorToken]);
  const doctorLogin = async () => {
    try {
      const res = await fetch(`${API_BASE}/doctor/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: loginName, password: loginPassword }),
      });
      if (!res.ok) throw new Error("login failed");
      const { token } = await res.json();
      localStorage.setItem("doctorToken", token);
      setDoctorToken(token);
      fetchPatients(token);
    } catch (err) {
      alert("login failed");
    }
  };
  const fetchPatients = async (token) => {
    try {
      const t = token ?? doctorToken;
      if (!t) return;
      const res = await fetch(`${API_BASE}/doctor/patients`, {
        headers: { "x-doctor-token": t },
      });
      if (!res.ok) throw new Error("fetch patients failed");
      const list = await res.json();
      setPatients(list);
    } catch (err) {
      console.error(err);
    }
  };
  const askAI = async () => {
    if (!aiInput.trim() || !selectedPatient) return;
    const userMessage = aiInput;
    setAiInput("");
    setAiChat((prev) => [...prev, { role: "doctor", text: userMessage }]);
    setAiLoading(true);
    try {
      // Build context from patient symptoms and current plan (if already assigned).
      const planSummary =
        selectedPatient.analysis?.schedule
          ?.map((s) => `${s.medication} at ${s.times.join(", ")}`)
          .join("\n") ?? "No treatment plan assigned yet.";
      const conditionSummary =
        selectedPatient.condition ?? "No condition assigned yet.";
      const context = `Patient: ${selectedPatient.name}
Condition: ${conditionSummary}
Symptoms reported:
${patientSymptoms || "No symptoms reported."}
Current medication plan:
${planSummary}

Doctor's query: ${userMessage}`;
      // Use backend proxy to call Gemini API to avoid CORS issues
      const res = await fetch(`${API_BASE}/api/v1/ask-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: `You are a medical AI assistant. Based on the patient symptoms and doctor's question, provide helpful diagnostic suggestions and medication recommendations. Keep responses concise and professional.\n\n${context}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "AI request failed");
      }
      const aiResponse = data.response || "No response from AI";
      setAiChat((prev) => [...prev, { role: "ai", text: aiResponse }]);
    } catch (err) {
      console.error(err);
      const errorMsg =
        err instanceof Error ? err.message : "Error connecting to AI service";
      setAiChat((prev) => [...prev, { role: "ai", text: `⚠️ ${errorMsg}` }]);
    } finally {
      setAiLoading(false);
    }
  };
  const deletePatientById = async (id) => {
    if (!confirm("Are you sure you want to delete this patient?")) return;
    try {
      const res = await fetch(`${API_BASE}/doctor/patients/${id}`, {
        method: "DELETE",
        headers: { "x-doctor-token": doctorToken ?? "" },
      });
      if (!res.ok) throw new Error("delete failed");
      setSelectedPatientId(null);
      setDoctorReplyInput("");
      setAiChat([]);
      await fetchPatients();
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };
  const labelPatient = async (id) => {
    const labelsRaw = prompt("Enter comma-separated labels:");
    if (labelsRaw == null) return;
    const labels = labelsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const res = await fetch(`${API_BASE}/doctor/patients/${id}/label`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-doctor-token": doctorToken ?? "",
        },
        body: JSON.stringify({ labels }),
      });
      if (!res.ok) throw new Error("label failed");
      fetchPatients();
    } catch (err) {
      console.error(err);
    }
  };
  const checkMeds = async (id) => {
    const medsRaw = prompt(
      'Enter medications as JSON array (e.g. [{"name":"A","dose":"10 mg","frequencyPerDay":1}])',
    );
    if (!medsRaw) return;
    try {
      const meds = JSON.parse(medsRaw);
      const res = await fetch(`${API_BASE}/doctor/patients/${id}/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-doctor-token": doctorToken ?? "",
        },
        body: JSON.stringify({ medications: meds }),
      });
      const data = await res.json();
      alert(JSON.stringify(data, null, 2));
    } catch (err) {
      alert("invalid meds JSON or request failed");
    }
  };
  const setPatientCondition = async (id) => {
    if (!conditionInput.trim()) {
      alert("Please enter a condition");
      return;
    }
    const filledMeds = medications.filter(
      (m) => m.name.trim() && m.dose.trim(),
    );
    if (filledMeds.length < 2 || filledMeds.length > 4) {
      alert("Please provide 2-4 medications");
      return;
    }
    setSettingCondition(true);
    try {
      const res = await fetch(`${API_BASE}/doctor/patients/${id}/condition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-doctor-token": doctorToken ?? "",
        },
        body: JSON.stringify({
          condition: conditionInput,
          medications: filledMeds,
        }),
      });
      if (!res.ok) throw new Error("Failed to set condition");
      const data = await res.json();
      alert(
        `✓ Done!\nCondition: ${conditionInput}\nPatient ${selectedPatient?.name} will now see their medication schedule.`,
      );
      setConditionInput("");
      setMedications([
        { name: "", dose: "", frequencyPerDay: 1 },
        { name: "", dose: "", frequencyPerDay: 1 },
      ]);
      setEditingConditionId(null);
      setAiChat([]);
      await fetchPatients();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to set condition");
    } finally {
      setSettingCondition(false);
    }
  };
  const enterEditMode = () => {
    if (!selectedPatient) return;
    setConditionInput(selectedPatient.condition || "");
    const meds = selectedPatient.analysis?.schedule.map((s) => ({
      name: s.medication,
      dose: "per schedule",
      frequencyPerDay: 1,
    })) || [
      { name: "", dose: "", frequencyPerDay: 1 },
      { name: "", dose: "", frequencyPerDay: 1 },
    ];
    setMedications(meds);
    setEditingConditionId(selectedPatient.id);
  };
  const cancelEdit = () => {
    setEditingConditionId(null);
    setConditionInput("");
    setMedications([
      { name: "", dose: "", frequencyPerDay: 1 },
      { name: "", dose: "", frequencyPerDay: 1 },
    ]);
  };
  const sendDoctorReply = async (id) => {
    const replyText = doctorReplyInput.trim();
    if (!replyText || !doctorToken) return;
    setSendingDoctorReply(true);
    try {
      const res = await fetch(`${API_BASE}/doctor/patients/${id}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-doctor-token": doctorToken,
        },
        body: JSON.stringify({ text: replyText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to send reply");
      }
      setDoctorReplyInput("");
      await fetchPatients();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSendingDoctorReply(false);
    }
  };
  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const selectedPatientMessageCount = countPatientMessages(
    selectedPatient?.feedback,
  );
  const patientSymptoms =
    selectedPatient?.reports.map((r) => r.text).join("\n") || "";
  const totalPatients = patients.length;
  const waitingPatients = patients.filter((p) => !p.condition).length;
  const assignedPatients = totalPatients - waitingPatients;
  const unreadMessages = patients.reduce(
    (sum, p) => sum + countPatientMessages(p.feedback),
    0,
  );
  if (!doctorToken) {
    return _jsx("main", {
      className: "auth-container",
      children: _jsxs("div", {
        className: "auth-card",
        children: [
          _jsxs("div", {
            className: "auth-header",
            children: [
              _jsx("h1", { children: "CoreTex" }),
              _jsx("p", {
                className: "auth-subtitle",
                children: "Doctor Portal",
              }),
            ],
          }),
          _jsxs("div", {
            className: "auth-form",
            children: [
              _jsx("h2", { children: "Doctor Login" }),
              _jsx("p", {
                className: "form-description",
                children: "Access the patient management dashboard",
              }),
              _jsxs("div", {
                className: "form-group",
                children: [
                  _jsx("label", { htmlFor: "name", children: "Name" }),
                  _jsx("input", {
                    id: "name",
                    type: "text",
                    value: loginName,
                    onChange: (e) => setLoginName(e.target.value),
                    placeholder: "Ahmed Mohamed",
                    onKeyPress: (e) => e.key === "Enter" && doctorLogin(),
                  }),
                ],
              }),
              _jsxs("div", {
                className: "form-group",
                children: [
                  _jsx("label", { htmlFor: "password", children: "Password" }),
                  _jsx("input", {
                    id: "password",
                    type: "password",
                    value: loginPassword,
                    onChange: (e) => setLoginPassword(e.target.value),
                    placeholder:
                      "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
                    onKeyPress: (e) => e.key === "Enter" && doctorLogin(),
                  }),
                ],
              }),
              _jsx("button", {
                className: "btn btn-primary",
                onClick: doctorLogin,
                children: "Login",
              }),
              _jsx("p", {
                className: "auth-footer",
                children: "Demo credentials: Ahmed Mohamed / 0000",
              }),
            ],
          }),
        ],
      }),
    });
  }
  return _jsxs("main", {
    className: "doctor-page-layout",
    children: [
      _jsx("header", {
        className: "doctor-header",
        children: _jsxs("div", {
          className: "header-content",
          children: [
            _jsxs("div", {
              children: [
                _jsx("p", { className: "eyebrow", children: "CoreTex" }),
                _jsx("h1", { children: "Doctor Dashboard" }),
                _jsx("p", {
                  className: "subhead",
                  children: "Patient Management & AI Consultation",
                }),
              ],
            }),
            _jsx("button", {
              className: "btn btn-secondary btn-sm",
              onClick: () => {
                localStorage.removeItem("doctorToken");
                setDoctorToken(null);
                setPatients([]);
                setSelectedPatientId(null);
                setDoctorReplyInput("");
                setAiChat([]);
              },
              children: "Logout",
            }),
          ],
        }),
      }),
      _jsxs("section", {
        className: "doctor-kpi-row",
        children: [
          _jsxs("article", {
            className: "kpi-card",
            children: [
              _jsx("p", { className: "kpi-label", children: "Total Patients" }),
              _jsx("p", { className: "kpi-value", children: totalPatients }),
            ],
          }),
          _jsxs("article", {
            className: "kpi-card",
            children: [
              _jsx("p", { className: "kpi-label", children: "Waiting Review" }),
              _jsx("p", { className: "kpi-value", children: waitingPatients }),
            ],
          }),
          _jsxs("article", {
            className: "kpi-card",
            children: [
              _jsx("p", { className: "kpi-label", children: "Plans Assigned" }),
              _jsx("p", { className: "kpi-value", children: assignedPatients }),
            ],
          }),
          _jsxs("article", {
            className: "kpi-card",
            children: [
              _jsx("p", {
                className: "kpi-label",
                children: "Unread Messages",
              }),
              _jsx("p", { className: "kpi-value", children: unreadMessages }),
            ],
          }),
        ],
      }),
      _jsxs("div", {
        className: "doctor-main-container",
        children: [
          _jsxs("aside", {
            className: "doctor-sidebar",
            children: [
              _jsxs("div", {
                className: "sidebar-header",
                children: [
                  _jsx("h2", { children: "Patients Waiting" }),
                  _jsx("button", {
                    className: "btn btn-secondary btn-sm",
                    onClick: () => fetchPatients(),
                    children: "\u21BB Refresh",
                  }),
                ],
              }),
              _jsx("div", {
                className: "patient-list",
                children:
                  patients.length === 0
                    ? _jsx("p", {
                        className: "empty-state",
                        children: "No patients yet",
                      })
                    : patients.map((p) => {
                        const patientMessageCount = countPatientMessages(
                          p.feedback,
                        );
                        return _jsxs(
                          "div",
                          {
                            className: `patient-list-item ${selectedPatientId === p.id ? "active" : ""}`,
                            onClick: () => {
                              setSelectedPatientId(p.id);
                              setAiChat([]);
                              setConditionInput("");
                              setMedications([
                                { name: "", dose: "", frequencyPerDay: 1 },
                                { name: "", dose: "", frequencyPerDay: 1 },
                              ]);
                              setDoctorReplyInput("");
                            },
                            children: [
                              _jsx("p", {
                                className: "list-patient-name",
                                children: p.name,
                              }),
                              _jsx("p", {
                                className: "list-patient-id",
                                children: p.id,
                              }),
                              p.condition &&
                                _jsxs("p", {
                                  className: "list-patient-condition",
                                  children: ["\u2713 ", p.condition],
                                }),
                              !p.condition &&
                                p.reports.length > 0 &&
                                _jsxs("p", {
                                  className: "list-patient-status",
                                  children: [
                                    p.reports.length,
                                    " report",
                                    p.reports.length !== 1 ? "s" : "",
                                  ],
                                }),
                              patientMessageCount > 0 &&
                                _jsxs("p", {
                                  className: "list-patient-status",
                                  children: [
                                    patientMessageCount,
                                    " new patient message",
                                    patientMessageCount !== 1 ? "s" : "",
                                  ],
                                }),
                            ],
                          },
                          p.id,
                        );
                      }),
              }),
            ],
          }),
          selectedPatient
            ? _jsxs("section", {
                className: "doctor-center",
                children: [
                  _jsxs("div", {
                    className: "patient-detail-header",
                    children: [
                      _jsxs("div", {
                        children: [
                          _jsx("h2", { children: selectedPatient.name }),
                          selectedPatient.condition &&
                            _jsxs("p", {
                              className: "assigned-condition",
                              children: [
                                "Condition: ",
                                selectedPatient.condition,
                              ],
                            }),
                          _jsxs("div", {
                            className: "patient-meta-row",
                            children: [
                              _jsx("span", {
                                className: `status-chip ${selectedPatient.condition ? "ok" : "warn"}`,
                                children: selectedPatient.condition
                                  ? "Plan Assigned"
                                  : "Waiting for Plan",
                              }),
                              selectedPatientMessageCount > 0 &&
                                _jsxs("span", {
                                  className: "status-chip info",
                                  children: [
                                    selectedPatientMessageCount,
                                    " patient message",
                                    selectedPatientMessageCount !== 1
                                      ? "s"
                                      : "",
                                  ],
                                }),
                            ],
                          }),
                        ],
                      }),
                      _jsx("button", {
                        className: "delete-patient-btn",
                        onClick: () => deletePatientById(selectedPatient.id),
                        children: "Delete Patient",
                      }),
                    ],
                  }),
                  !selectedPatient.condition &&
                    _jsxs("div", {
                      className: "symptoms-section",
                      children: [
                        _jsx("h3", { children: "Reported Symptoms" }),
                        _jsx("div", {
                          className: "symptoms-list",
                          children:
                            selectedPatient.reports.length > 0
                              ? selectedPatient.reports.map((r, idx) =>
                                  _jsxs(
                                    "div",
                                    {
                                      className: "symptom-item",
                                      children: [
                                        _jsx("small", {
                                          children: new Date(
                                            r.timestamp,
                                          ).toLocaleString(),
                                        }),
                                        _jsx("p", { children: r.text }),
                                      ],
                                    },
                                    idx,
                                  ),
                                )
                              : _jsx("p", {
                                  className: "empty-state",
                                  children: "No symptoms reported yet",
                                }),
                        }),
                      ],
                    }),
                  !selectedPatient.condition &&
                    _jsxs("div", {
                      className: "condition-form",
                      children: [
                        _jsx("h3", {
                          children: "Assign Condition & Medications",
                        }),
                        _jsxs("div", {
                          className: "form-group",
                          children: [
                            _jsx("label", {
                              htmlFor: "condition",
                              children: "Condition/Diagnosis",
                            }),
                            _jsx("input", {
                              id: "condition",
                              type: "text",
                              value: conditionInput,
                              onChange: (e) =>
                                setConditionInput(e.target.value),
                              placeholder: "e.g., Hypertension, Diabetes...",
                            }),
                          ],
                        }),
                        _jsxs("div", {
                          className: "medications-section",
                          children: [
                            _jsx("label", {
                              children: "Medications (Add 2-4)",
                            }),
                            _jsx("div", {
                              className: "medications-list",
                              children: medications.map((med, idx) =>
                                _jsxs(
                                  "div",
                                  {
                                    className: "medication-row",
                                    children: [
                                      _jsx("input", {
                                        type: "text",
                                        value: med.name,
                                        onChange: (e) => {
                                          const newMeds = [...medications];
                                          newMeds[idx].name = e.target.value;
                                          setMedications(newMeds);
                                        },
                                        placeholder: "Medication name",
                                      }),
                                      _jsx("input", {
                                        type: "text",
                                        value: med.dose,
                                        onChange: (e) => {
                                          const newMeds = [...medications];
                                          newMeds[idx].dose = e.target.value;
                                          setMedications(newMeds);
                                        },
                                        placeholder: "Dose (e.g., 10mg)",
                                      }),
                                      _jsxs("select", {
                                        value: med.frequencyPerDay,
                                        onChange: (e) => {
                                          const newMeds = [...medications];
                                          newMeds[idx].frequencyPerDay =
                                            parseInt(e.target.value);
                                          setMedications(newMeds);
                                        },
                                        children: [
                                          _jsx("option", {
                                            value: 1,
                                            children: "1x/day",
                                          }),
                                          _jsx("option", {
                                            value: 2,
                                            children: "2x/day",
                                          }),
                                          _jsx("option", {
                                            value: 3,
                                            children: "3x/day",
                                          }),
                                          _jsx("option", {
                                            value: 4,
                                            children: "4x/day",
                                          }),
                                        ],
                                      }),
                                      medications.length > 2 &&
                                        _jsx("button", {
                                          className: "btn btn-danger btn-sm",
                                          onClick: () => {
                                            setMedications(
                                              medications.filter(
                                                (_, i) => i !== idx,
                                              ),
                                            );
                                          },
                                          children: "Remove",
                                        }),
                                    ],
                                  },
                                  idx,
                                ),
                              ),
                            }),
                            medications.length < 4 &&
                              _jsx("button", {
                                className: "btn btn-secondary btn-sm",
                                onClick: () => {
                                  setMedications([
                                    ...medications,
                                    { name: "", dose: "", frequencyPerDay: 1 },
                                  ]);
                                },
                                children: "+ Add Medication",
                              }),
                          ],
                        }),
                        _jsx("button", {
                          className: "btn btn-primary",
                          onClick: () =>
                            setPatientCondition(selectedPatient.id),
                          disabled: settingCondition || !conditionInput.trim(),
                          children: settingCondition
                            ? "Assigning..."
                            : "Assign Condition & Generate Schedule",
                        }),
                      ],
                    }),
                  selectedPatient.condition &&
                    editingConditionId !== selectedPatient.id &&
                    _jsxs("div", {
                      className: "assigned-info",
                      children: [
                        _jsxs("p", {
                          className: "form-description",
                          children: [
                            "\u2713 Done. Patient ",
                            selectedPatient.name,
                            " can now see their treatment plan.",
                          ],
                        }),
                        _jsx("div", {
                          style: {
                            display: "flex",
                            gap: "8px",
                            justifyContent: "center",
                          },
                          children: _jsx("button", {
                            className: "btn btn-secondary btn-sm",
                            onClick: enterEditMode,
                            children: "Edit Condition",
                          }),
                        }),
                      ],
                    }),
                  editingConditionId === selectedPatient?.id &&
                    _jsxs("div", {
                      className: "condition-form",
                      children: [
                        _jsx("h3", {
                          children: "Edit Condition & Medications",
                        }),
                        _jsxs("div", {
                          className: "form-group",
                          children: [
                            _jsx("label", {
                              htmlFor: "condition-edit",
                              children: "Condition/Diagnosis",
                            }),
                            _jsx("input", {
                              id: "condition-edit",
                              type: "text",
                              value: conditionInput,
                              onChange: (e) =>
                                setConditionInput(e.target.value),
                              placeholder: "e.g., Hypertension, Diabetes...",
                            }),
                          ],
                        }),
                        _jsxs("div", {
                          className: "medications-section",
                          children: [
                            _jsx("label", {
                              children: "Medications (Add 2-4)",
                            }),
                            _jsx("div", {
                              className: "medications-list",
                              children: medications.map((med, idx) =>
                                _jsxs(
                                  "div",
                                  {
                                    className: "medication-row",
                                    children: [
                                      _jsx("input", {
                                        type: "text",
                                        value: med.name,
                                        onChange: (e) => {
                                          const newMeds = [...medications];
                                          newMeds[idx].name = e.target.value;
                                          setMedications(newMeds);
                                        },
                                        placeholder: "Medication name",
                                      }),
                                      _jsx("input", {
                                        type: "text",
                                        value: med.dose,
                                        onChange: (e) => {
                                          const newMeds = [...medications];
                                          newMeds[idx].dose = e.target.value;
                                          setMedications(newMeds);
                                        },
                                        placeholder: "Dose (e.g., 10mg)",
                                      }),
                                      _jsxs("select", {
                                        value: med.frequencyPerDay,
                                        onChange: (e) => {
                                          const newMeds = [...medications];
                                          newMeds[idx].frequencyPerDay =
                                            parseInt(e.target.value);
                                          setMedications(newMeds);
                                        },
                                        children: [
                                          _jsx("option", {
                                            value: 1,
                                            children: "1x/day",
                                          }),
                                          _jsx("option", {
                                            value: 2,
                                            children: "2x/day",
                                          }),
                                          _jsx("option", {
                                            value: 3,
                                            children: "3x/day",
                                          }),
                                          _jsx("option", {
                                            value: 4,
                                            children: "4x/day",
                                          }),
                                        ],
                                      }),
                                      medications.length > 2 &&
                                        _jsx("button", {
                                          className: "btn btn-danger btn-sm",
                                          onClick: () => {
                                            setMedications(
                                              medications.filter(
                                                (_, i) => i !== idx,
                                              ),
                                            );
                                          },
                                          children: "Remove",
                                        }),
                                    ],
                                  },
                                  idx,
                                ),
                              ),
                            }),
                            medications.length < 4 &&
                              _jsx("button", {
                                className: "btn btn-secondary btn-sm",
                                onClick: () => {
                                  setMedications([
                                    ...medications,
                                    { name: "", dose: "", frequencyPerDay: 1 },
                                  ]);
                                },
                                children: "+ Add Medication",
                              }),
                          ],
                        }),
                        _jsxs("div", {
                          style: { display: "flex", gap: "8px" },
                          children: [
                            _jsx("button", {
                              className: "btn btn-primary",
                              onClick: () =>
                                setPatientCondition(selectedPatient.id),
                              disabled:
                                settingCondition || !conditionInput.trim(),
                              style: { flex: 1 },
                              children: settingCondition
                                ? "Updating..."
                                : "Update Condition & Schedule",
                            }),
                            _jsx("button", {
                              className: "btn btn-secondary",
                              onClick: cancelEdit,
                              disabled: settingCondition,
                              children: "Cancel",
                            }),
                          ],
                        }),
                      ],
                    }),
                  _jsxs("div", {
                    className: "patient-feedback-section",
                    children: [
                      _jsx("h3", { children: "Patient Messages" }),
                      (selectedPatient.feedback?.length ?? 0) > 0
                        ? _jsx("div", {
                            className: "feedback-list",
                            children: selectedPatient.feedback?.map(
                              (f, idx) => {
                                const isDoctorMessage = f.sender === "doctor";
                                return _jsxs(
                                  "div",
                                  {
                                    className: `feedback-item ${isDoctorMessage ? "feedback-doctor" : "feedback-patient"}`,
                                    children: [
                                      _jsxs("div", {
                                        className: "feedback-meta",
                                        children: [
                                          _jsx("span", {
                                            className: `feedback-author ${isDoctorMessage ? "doctor" : "patient"}`,
                                            children: isDoctorMessage
                                              ? "You"
                                              : "Patient",
                                          }),
                                          _jsx("small", {
                                            children: new Date(
                                              f.timestamp,
                                            ).toLocaleString(),
                                          }),
                                        ],
                                      }),
                                      _jsx("p", { children: f.text }),
                                    ],
                                  },
                                  `${f.timestamp}-${idx}`,
                                );
                              },
                            ),
                          })
                        : _jsx("p", {
                            className: "form-description",
                            children:
                              "No patient messages yet. Use this box to send proactive guidance.",
                          }),
                      _jsxs("div", {
                        className: "doctor-reply-form",
                        children: [
                          _jsx("textarea", {
                            className: "doctor-reply-input",
                            rows: 3,
                            value: doctorReplyInput,
                            onChange: (e) =>
                              setDoctorReplyInput(e.target.value),
                            onKeyDown: (e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void sendDoctorReply(selectedPatient.id);
                              }
                            },
                            placeholder:
                              "Reply to patient updates without changing the treatment plan...",
                          }),
                          _jsx("button", {
                            className: "btn btn-primary",
                            onClick: () =>
                              void sendDoctorReply(selectedPatient.id),
                            disabled:
                              !doctorReplyInput.trim() || sendingDoctorReply,
                            children: sendingDoctorReply
                              ? "Sending..."
                              : "Send Reply",
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              })
            : _jsx("section", {
                className: "doctor-center",
                children: _jsx("p", {
                  className: "empty-state",
                  children:
                    "Select a patient to view symptoms and assign a condition",
                }),
              }),
          selectedPatient &&
            _jsxs("aside", {
              className: "doctor-ai-panel",
              children: [
                _jsxs("div", {
                  className: "ai-header",
                  children: [
                    _jsx("h3", { children: "AI Consultant" }),
                    _jsx("p", {
                      className: "ai-subtitle",
                      children: "Ask for diagnosis or treatment-plan guidance",
                    }),
                  ],
                }),
                _jsx("div", {
                  className: "ai-chat-container",
                  children:
                    aiChat.length === 0
                      ? _jsxs("div", {
                          className: "ai-welcome",
                          children: [
                            _jsx("p", {
                              children:
                                "Ask me for help diagnosing the patient's condition based on their symptoms.",
                            }),
                            _jsxs("ul", {
                              children: [
                                _jsx("li", {
                                  children:
                                    '"What conditions match these symptoms?"',
                                }),
                                _jsx("li", {
                                  children: '"What medications would help?"',
                                }),
                                _jsx("li", {
                                  children:
                                    '"Are there any interactions I should know about?"',
                                }),
                              ],
                            }),
                          ],
                        })
                      : _jsxs("div", {
                          className: "ai-messages",
                          children: [
                            aiChat.map((msg, idx) =>
                              _jsx(
                                "div",
                                {
                                  className: `ai-message ai-${msg.role}`,
                                  children: _jsx(ReactMarkdown, {
                                    children: msg.text,
                                  }),
                                },
                                idx,
                              ),
                            ),
                            aiLoading &&
                              _jsx("div", {
                                className: "ai-loading",
                                children: "AI is thinking...",
                              }),
                            _jsx("div", { ref: chatEndRef }),
                          ],
                        }),
                }),
                _jsxs("div", {
                  className: "ai-quick-prompts",
                  children: [
                    _jsx("button", {
                      className: "quick-prompt-btn",
                      onClick: () =>
                        setAiInput(
                          "Summarize this case in 3 concise bullet points.",
                        ),
                      children: "Case Summary",
                    }),
                    _jsx("button", {
                      className: "quick-prompt-btn",
                      onClick: () =>
                        setAiInput(
                          "Suggest a safer alternative plan and explain why in simple terms.",
                        ),
                      children: "Safer Plan",
                    }),
                    _jsx("button", {
                      className: "quick-prompt-btn",
                      onClick: () =>
                        setAiInput(
                          "Create a patient-friendly counseling script for this medication plan.",
                        ),
                      children: "Counseling Script",
                    }),
                  ],
                }),
                _jsxs("div", {
                  className: "ai-input-area",
                  children: [
                    _jsx("input", {
                      type: "text",
                      value: aiInput,
                      onChange: (e) => setAiInput(e.target.value),
                      onKeyPress: (e) => e.key === "Enter" && askAI(),
                      placeholder: "Ask AI about the patient...",
                      disabled: aiLoading,
                    }),
                    _jsx("button", {
                      className: "btn btn-small",
                      onClick: askAI,
                      disabled: !aiInput.trim() || aiLoading,
                      children: "Send",
                    }),
                  ],
                }),
              ],
            }),
        ],
      }),
    ],
  });
}
