"use client";

import React, { useState } from "react";
import Link from "next/link";

const BACKEND_URL = "http://localhost:3000";

interface Skill {
  name: string;
  weightage: number;
}

export default function SetupPage() {
  // Credentials States
  const [deepgramKey, setDeepgramKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [credMessage, setCredMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Agent Config States
  const [name, setName] = useState("");
  const [llmModel, setLlmModel] = useState("gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState("");
  
  // Collapsible Context Panel State
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  
  // Context Fields
  const [jobDescription, setJobDescription] = useState("");
  const [candidateResume, setCandidateResume] = useState("");
  const [interviewDuration, setInterviewDuration] = useState("");
  const [voicePreference, setVoicePreference] = useState("aura-asteria-en");
  const [skills, setSkills] = useState<Skill[]>([{ name: "", weightage: 0 }]);
  const [questions, setQuestions] = useState<string[]>([""]);
  
  // Config Status States
  const [configMessage, setConfigMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [createdConfigId, setCreatedConfigId] = useState<string | null>(null);

  // Dropdown list states for editing existing config
  const [configs, setConfigs] = useState<any[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState("");

  const loadConfigs = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/agent-configs`);
      if (!res.ok) throw new Error("Failed to fetch configs");
      const data = await res.json();
      setConfigs(data);
    } catch (err: any) {
      console.error("Error loading agent configurations:", err);
    }
  };

  React.useEffect(() => {
    loadConfigs();
  }, []);

  const handleSelectConfig = (configId: string) => {
    setSelectedConfigId(configId);
    if (!configId) {
      // Reset form states to start fresh
      setName("");
      setLlmModel("gpt-4o-mini");
      setSystemPrompt("");
      setJobDescription("");
      setCandidateResume("");
      setInterviewDuration("");
      setVoicePreference("aura-asteria-en");
      setSkills([{ name: "", weightage: 0 }]);
      setQuestions([""]);
      setIsContextExpanded(false);
      setCreatedConfigId(null);
      setConfigMessage(null);
      return;
    }

    const config = configs.find((c) => c.id === configId);
    if (config) {
      setName(config.name || "");
      setLlmModel(config.llmModel || "gpt-4o-mini");
      setSystemPrompt(config.systemPrompt || "");
      setJobDescription(config.jobDescription || "");
      setCandidateResume(config.candidateResume || "");
      setInterviewDuration(config.interviewDurationMinutes ? String(config.interviewDurationMinutes) : "");
      setVoicePreference(config.voicePreference || "aura-asteria-en");

      if (config.interviewPreferences && Array.isArray(config.interviewPreferences)) {
        setSkills(config.interviewPreferences);
      } else {
        setSkills([{ name: "", weightage: 0 }]);
      }

      if (config.uploadedQuestions && Array.isArray(config.uploadedQuestions)) {
        setQuestions(config.uploadedQuestions);
      } else {
        setQuestions([""]);
      }

      if (
        config.jobDescription ||
        config.candidateResume ||
        config.interviewDurationMinutes ||
        (config.interviewPreferences && config.interviewPreferences.length > 0) ||
        (config.uploadedQuestions && config.uploadedQuestions.length > 0)
      ) {
        setIsContextExpanded(true);
      } else {
        setIsContextExpanded(false);
      }

      setCreatedConfigId(null);
      setConfigMessage(null);
    }
  };

  // Save Credentials (POST /api/credentials)
  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredMessage(null);

    if (!deepgramKey.trim() && !openaiKey.trim()) {
      setCredMessage({ text: "Please enter at least one key to save.", isError: true });
      return;
    }

    // Validate inputs
    if (openaiKey.trim()) {
      const val = openaiKey.trim();
      if (val.includes("=")) {
        setCredMessage({ text: "OpenAI API Key must not contain '='. Enter only the key value (e.g. starting with 'sk-').", isError: true });
        return;
      }
      if (!val.startsWith("sk-")) {
        setCredMessage({ text: "Invalid OpenAI API Key format. Key must start with 'sk-'.", isError: true });
        return;
      }
    }

    if (deepgramKey.trim()) {
      const val = deepgramKey.trim();
      if (val.includes("=")) {
        setCredMessage({ text: "Deepgram API Key must not contain '='. Enter only the key value.", isError: true });
        return;
      }
      if (val.length < 10) {
        setCredMessage({ text: "Invalid Deepgram API Key. Key must be at least 10 characters long.", isError: true });
        return;
      }
    }

    try {
      let savedCount = 0;

      if (deepgramKey.trim()) {
        const res = await fetch(`${BACKEND_URL}/api/credentials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "deepgram", key: deepgramKey.trim() }),
        });
        if (!res.ok) throw new Error("Failed to save Deepgram key");
        savedCount++;
      }

      if (openaiKey.trim()) {
        const res = await fetch(`${BACKEND_URL}/api/credentials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "openai", key: openaiKey.trim() }),
        });
        if (!res.ok) throw new Error("Failed to save OpenAI key");
        savedCount++;
      }

      setCredMessage({
        text: `Successfully saved ${savedCount} API key(s). Keys are encrypted at rest.`,
        isError: false,
      });
      setDeepgramKey("");
      setOpenaiKey("");
    } catch (err: any) {
      setCredMessage({ text: err.message || "Failed to save credentials.", isError: true });
    }
  };

  // Skills List Mutators
  const addSkill = () => setSkills([...skills, { name: "", weightage: 0 }]);
  const removeSkill = (index: number) => setSkills(skills.filter((_, i) => i !== index));
  const updateSkill = (index: number, field: keyof Skill, value: any) => {
    const updated = [...skills];
    updated[index] = { ...updated[index], [field]: value };
    setSkills(updated);
  };

  // Questions List Mutators
  const addQuestion = () => setQuestions([...questions, ""]);
  const removeQuestion = (index: number) => setQuestions(questions.filter((_, i) => i !== index));
  const updateQuestion = (index: number, value: string) => {
    const updated = [...questions];
    updated[index] = value;
    setQuestions(updated);
  };

  // Submit Agent Config (POST /api/agent-configs or PUT /api/agent-configs/:id)
  const handleSubmitConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigMessage(null);
    setCreatedConfigId(null);

    if (!systemPrompt.trim()) {
      setConfigMessage({ text: "System Prompt is required.", isError: true });
      return;
    }

    // Prepare payload
    const filteredSkills = skills.filter((s) => s.name.trim() !== "");
    const filteredQuestions = questions.filter((q) => q.trim() !== "");
    const duration = interviewDuration ? parseInt(interviewDuration, 10) : null;

    const payload = {
      name: name.trim() || null,
      systemPrompt: systemPrompt.trim(),
      llmModel,
      voicePreference: voicePreference || null,
      jobDescription: jobDescription.trim() || null,
      candidateResume: candidateResume.trim() || null,
      interviewPreferences: filteredSkills.length > 0 ? filteredSkills : null,
      interviewDurationMinutes: duration,
      uploadedQuestions: filteredQuestions.length > 0 ? filteredQuestions : null,
    };

    const isEdit = !!selectedConfigId;
    const url = isEdit
      ? `${BACKEND_URL}/api/agent-configs/${selectedConfigId}`
      : `${BACKEND_URL}/api/agent-configs`;
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData?.error || `Failed to ${isEdit ? "update" : "create"} configuration.`);
      }

      const config = await res.json();
      setCreatedConfigId(config.id);
      
      const createdVersion = config.version || 1;
      setConfigMessage({
        text: `Agent Configuration successfully ${isEdit ? "updated (new version saved)" : "created"}! Version: ${createdVersion}`,
        isError: false,
      });

      // Update local dropdown select to match newly saved config ID
      if (!isEdit) {
        setSelectedConfigId(config.id);
      }

      // Re-fetch dropdown configs to keep options in-sync
      await loadConfigs();
    } catch (err: any) {
      setConfigMessage({ text: err.message || "Failed to save configuration.", isError: true });
    }
  };

  return (
    <div className="container">
      <h1>Voice AI Agent Platform — Setup</h1>
      
      <div style={{ marginBottom: "20px", display: "flex", gap: "12px" }}>
        <Link href="/test-voice" className="btn btn-secondary">
          Go to Voice Testing Page &rarr;
        </Link>
        <Link href="/sessions" className="btn btn-secondary">
          View Session History &rarr;
        </Link>
      </div>

      {/* API Credentials Setup */}
      <div className="card">
        <h2>1. API Credentials</h2>
        {credMessage && (
          <div className={`alert ${credMessage.isError ? "alert-error" : "alert-success"}`}>
            {credMessage.text}
          </div>
        )}
        <form onSubmit={handleSaveCredentials}>
          <div className="form-group">
            <label htmlFor="deepgram-key">Deepgram API Key</label>
            <input
              id="deepgram-key"
              type="password"
              placeholder="Enter Deepgram API Key (will be encrypted)"
              value={deepgramKey}
              onChange={(e) => setDeepgramKey(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="openai-key">OpenAI API Key</label>
            <input
              id="openai-key"
              type="password"
              placeholder="Enter OpenAI API Key (will be encrypted)"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Save Credentials
          </button>
        </form>
      </div>

      {/* Agent Config Form */}
      <div className="card">
        <h2>2. Agent Configuration</h2>
        
        <div className="form-group" style={{ marginBottom: "20px" }}>
          <label htmlFor="select-config" style={{ fontWeight: "bold", display: "block", marginBottom: "8px" }}>
            Select Existing Agent Configuration to Edit
          </label>
          <select
            id="select-config"
            value={selectedConfigId}
            onChange={(e) => handleSelectConfig(e.target.value)}
            style={{
              padding: "10px",
              borderRadius: "6px",
              backgroundColor: "#0d0f12",
              color: "#ffffff",
              border: "1px solid var(--border-color)",
              width: "100%",
              fontSize: "14px"
            }}
          >
            <option value="">-- Create New Agent Config (Start Fresh) --</option>
            {configs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || "Unnamed Agent"} (v{c.version || 1})
              </option>
            ))}
          </select>
        </div>

        {configMessage && (
          <div className={`alert ${configMessage.isError ? "alert-error" : "alert-success"}`}>
            {configMessage.text}
            {createdConfigId && (
              <div style={{ marginTop: "8px", fontSize: "13px" }}>
                <strong>Config ID:</strong> <code style={{ backgroundColor: "#0d0f12", padding: "2px 6px", borderRadius: "4px" }}>{createdConfigId}</code>
              </div>
            )}
          </div>
        )}
        <form onSubmit={handleSubmitConfig}>
          <div className="form-group">
            <label htmlFor="config-name">Agent Name (Optional)</label>
            <input
              id="config-name"
              type="text"
              placeholder="e.g. Technical Interviewer, French Tutor"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="llm-model">LLM Model</label>
            <select
              id="llm-model"
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
            >
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4o">gpt-4o</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="system-prompt">System Prompt (Required)</label>
            <textarea
              id="system-prompt"
              placeholder="Define your voice agent's behavior, personality, and instructions..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              required
            />
          </div>

          {/* Collapsible Optional Block */}
          <div className="form-group" style={{ marginTop: "24px" }}>
            <div
              className="collapsible-header"
              onClick={() => setIsContextExpanded(!isContextExpanded)}
            >
              <span>{isContextExpanded ? "▼" : "▶"} Interview Context (Optional)</span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Conditionally appends context to prompt
              </span>
            </div>

            {isContextExpanded && (
              <div className="collapsible-content">
                <div className="form-group">
                  <label htmlFor="job-description">Job Description</label>
                  <textarea
                    id="job-description"
                    placeholder="Paste job description..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="candidate-resume">Candidate Resume</label>
                  <textarea
                    id="candidate-resume"
                    placeholder="Paste candidate resume..."
                    value={candidateResume}
                    onChange={(e) => setCandidateResume(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="voice-pref">Voice Preference</label>
                  <select
                    id="voice-pref"
                    value={voicePreference}
                    onChange={(e) => setVoicePreference(e.target.value)}
                  >
                    <option value="aura-asteria-en">Aura Asteria (English - Female)</option>
                    <option value="aura-luna-en">Aura Luna (English - Female)</option>
                    <option value="aura-stella-en">Aura Stella (English - Female)</option>
                    <option value="aura-athena-en">Aura Athena (English - Female)</option>
                    <option value="aura-arcas-en">Aura Arcas (English - Male)</option>
                    <option value="aura-perseus-en">Aura Perseus (English - Male)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="duration">Interview Duration (Minutes)</label>
                  <input
                    id="duration"
                    type="number"
                    placeholder="e.g. 30"
                    value={interviewDuration}
                    onChange={(e) => setInterviewDuration(e.target.value)}
                  />
                </div>

                {/* Repeatable Skills List */}
                <div className="form-group">
                  <label>Skills & Target Weightage (%)</label>
                  {skills.map((skill, index) => (
                    <div key={index} className="repeatable-item">
                      <input
                        type="text"
                        placeholder="Skill (e.g. Kubernetes)"
                        value={skill.name}
                        onChange={(e) => updateSkill(index, "name", e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="Weightage % (e.g. 40)"
                        value={skill.weightage || ""}
                        onChange={(e) => updateSkill(index, "weightage", parseInt(e.target.value, 10) || 0)}
                        style={{ maxWidth: "120px" }}
                      />
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => removeSkill(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary" onClick={addSkill}>
                    + Add Skill
                  </button>
                </div>

                {/* Repeatable Questions List */}
                <div className="form-group">
                  <label>Predefined Questions</label>
                  {questions.map((question, index) => (
                    <div key={index} className="repeatable-item">
                      <input
                        type="text"
                        placeholder={`Question ${index + 1}`}
                        value={question}
                        onChange={(e) => updateQuestion(index, e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => removeQuestion(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary" onClick={addQuestion}>
                    + Add Question
                  </button>
                </div>
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "20px" }}>
            {selectedConfigId ? "Save New Version" : "Create Config"}
          </button>
        </form>
      </div>
    </div>
  );
}
