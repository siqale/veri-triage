import { useState } from 'react';

const API_URL = 'http://localhost:8000';

type Role = 'TRIAGEM' | 'RECEPÇÃO' | 'MÉDICO' | 'QA HARNESS';
type PatientStatus = 'WAITING_RECEPTION' | 'WAITING_DOCTOR' | 'COMPLETED' | 'ERROR';

type Patient = {
  id: string; // We'll just use a random string or the thread_id
  thread_id?: string;
  
  // Triage Data
  symptomsText: string;
  suggestedRisk?: string;
  extractedData?: any;
  status: PatientStatus;
  
  // Reception Data
  fullName?: string;
  cpf?: string;
  healthPlan?: string;
  
  // Doctor Data
  soapSummary?: string;
  errorDetail?: string;
};

type QAResult = {
  case_id: string;
  description: string;
  expected_risk: string;
  predicted_risk: string;
  passed: boolean;
};

type QAMetrics = {
  total_cases: number;
  passed: number;
  failed: number;
  accuracy_percent: number;
};

export default function App() {
  const [currentRole, setCurrentRole] = useState<Role>('TRIAGEM');
  const [patients, setPatients] = useState<Patient[]>([]);
  
  // Triage Form State
  const [patientText, setPatientText] = useState('');
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);

  // Reception State
  const [selectedForReception, setSelectedForReception] = useState<Patient | null>(null);
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [healthPlan, setHealthPlan] = useState('');

  // Doctor State
  const [selectedForDoctor, setSelectedForDoctor] = useState<Patient | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [resumeAction, setResumeAction] = useState<'approve' | 'reject'>('approve');
  const [resumeReason, setResumeReason] = useState('');

  // QA Harness State
  const [qaLoading, setQaLoading] = useState(false);
  const [qaMetrics, setQaMetrics] = useState<QAMetrics | null>(null);
  const [qaResults, setQaResults] = useState<QAResult[]>([]);

  // Helper to render risk badge
  const renderBadge = (risk?: string) => {
    const riskLower = risk?.toLowerCase() || '';
    if (riskLower.includes('vermelho')) return <span className="badge badge-vermelho">Vermelho</span>;
    if (riskLower.includes('laranja')) return <span className="badge badge-laranja">Laranja</span>;
    if (riskLower.includes('amarelo')) return <span className="badge badge-amarelo">Amarelo</span>;
    if (riskLower.includes('verde')) return <span className="badge badge-verde">Verde</span>;
    if (riskLower.includes('azul')) return <span className="badge badge-azul">Azul</span>;
    return <span className="badge badge-indefinido">{risk || 'Aguardando'}</span>;
  };

  // -------------------------------------------------------------
  // ACTION: NURSE (TRIAGE)
  // -------------------------------------------------------------
  const handleStartTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientText.trim()) return;
    
    setTriageLoading(true);
    setTriageError(null);
    
    try {
      const res = await fetch(`${API_URL}/triage/start`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-API-Key': 'sua_senha_secreta_aqui'
        },
        body: JSON.stringify({ patient_text: patientText })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ? JSON.stringify(data.detail) : 'Erro na requisição');
      
      const newPatient: Patient = {
        id: data.thread_id || Math.random().toString(36).substring(7),
        thread_id: data.thread_id,
        symptomsText: patientText,
        suggestedRisk: data.suggested_risk,
        extractedData: data.extracted_data,
        status: data.status === 'WAITING_HUMAN_APPROVAL' ? 'WAITING_RECEPTION' : 'ERROR',
        errorDetail: data.status === 'WAITING_HUMAN_APPROVAL' ? undefined : 'Triagem abortou antes da aprovação.'
      };

      setPatients(prev => [...prev, newPatient]);
      setPatientText('');
      
    } catch (err: any) {
      setTriageError(err.message);
    } finally {
      setTriageLoading(false);
    }
  };

  // -------------------------------------------------------------
  // ACTION: RECEPTIONIST
  // -------------------------------------------------------------
  const handleReceptionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForReception) return;

    setPatients(prev => prev.map(p => {
      if (p.id === selectedForReception.id) {
        return { ...p, fullName, cpf, healthPlan, status: 'WAITING_DOCTOR' };
      }
      return p;
    }));

    setSelectedForReception(null);
    setFullName('');
    setCpf('');
    setHealthPlan('');
  };

  // -------------------------------------------------------------
  // ACTION: DOCTOR
  // -------------------------------------------------------------
  const handleDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForDoctor?.thread_id) return;
    
    setDoctorLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/triage/resume/${selectedForDoctor.thread_id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-API-Key': 'sua_senha_secreta_aqui'
        },
        body: JSON.stringify({ 
          approved_risk: selectedForDoctor.suggestedRisk || 'Indefinido',
          doctor_id: 'CRM-123456',
          observations: resumeAction === 'reject' ? resumeReason : 'Aprovado sem ressalvas'
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ? JSON.stringify(data.detail) : 'Erro na requisição');
      
      setPatients(prev => prev.map(p => {
        if (p.id === selectedForDoctor.id) {
          return { ...p, status: 'COMPLETED', soapSummary: data.soap_summary };
        }
        return p;
      }));

      setSelectedForDoctor(null);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setDoctorLoading(false);
    }
  };

  // -------------------------------------------------------------
  // ACTION: QA HARNESS (RUN EVALUATION)
  // -------------------------------------------------------------
  const handleRunQA = async () => {
    setQaLoading(true);
    try {
      const res = await fetch(`${API_URL}/triage/eval-harness`, {
        headers: {
          'X-API-Key': 'sua_senha_secreta_aqui'
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao rodar QA Harness');
      
      setQaMetrics(data.metrics);
      setQaResults(data.results);
    } catch (err: any) {
      alert(`Erro no QA Harness: ${err.message}`);
    } finally {
      setQaLoading(false);
    }
  };

  return (
    <div className="container animate-fade-in">
      <div className="header">
        <h1>VeriTriage AI</h1>
        <p>Sistema Avançado de Triagem - Role-Based Workflow</p>
      </div>

      {/* Role Switcher */}
      <div className="tabs">
        {(['TRIAGEM', 'RECEPÇÃO', 'MÉDICO', 'QA HARNESS'] as Role[]).map(role => (
          <button 
            key={role}
            className={`tab-btn ${currentRole === role ? 'active' : ''}`}
            onClick={() => setCurrentRole(role)}
          >
            {role === 'TRIAGEM' && '👩‍⚕️ '}
            {role === 'RECEPÇÃO' && '📋 '}
            {role === 'MÉDICO' && '👨‍⚕️ '}
            {role === 'QA HARNESS' && '📊 '}
            {role}
          </button>
        ))}
      </div>

      {/* ======================= TRIAGEM (NURSE) ======================= */}
      {currentRole === 'TRIAGEM' && (
        <div className="glass-panel animate-fade-in" style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Atendimento de Triagem</h2>
          <form onSubmit={handleStartTriage}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                Relato Clínico Inicial
              </label>
              <textarea 
                className="input-field" 
                rows={4}
                value={patientText}
                onChange={e => setPatientText(e.target.value)}
                placeholder="Insira os sintomas para a IA processar o protocolo..."
                required
              />
            </div>
            
            <button type="submit" className="btn" disabled={triageLoading} style={{ width: '100%' }}>
              {triageLoading ? 'Analisando RAG e Guardrails...' : 'Enviar para Classificação AI'}
            </button>
          </form>
          
          {triageError && (
            <div style={{ marginTop: '20px', padding: '16px', borderRadius: '8px', background: 'rgba(218, 54, 51, 0.1)', border: '1px solid rgba(218, 54, 51, 0.3)' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#ff7b72' }}>Erro de Processamento</h3>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>{triageError}</p>
            </div>
          )}
        </div>
      )}

      {/* ======================= RECEPÇÃO (BALCÃO) ======================= */}
      {currentRole === 'RECEPÇÃO' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ marginTop: 0 }}>Fila de Atendimento</h3>
            {patients.filter(p => p.status === 'WAITING_RECEPTION').length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nenhum paciente aguardando ficha.</p>
            ) : (
              patients.filter(p => p.status === 'WAITING_RECEPTION').map(p => (
                <div 
                  key={p.id} 
                  className={`patient-card ${selectedForReception?.id === p.id ? 'active' : ''}`}
                  onClick={() => setSelectedForReception(p)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>Paciente Pendente</strong>
                    {renderBadge(p.suggestedRisk)}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.symptomsText}
                  </p>
                </div>
              ))
            )}
          </div>
          
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ marginTop: 0 }}>Abertura de Ficha</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Dados de identificação (PII) são inseridos aqui e mantidos apenas na interface para preservar a LGPD na camada da IA.
            </p>
            
            {!selectedForReception ? (
              <p style={{ color: 'var(--text-secondary)' }}>Selecione um paciente na fila ao lado.</p>
            ) : (
              <form onSubmit={handleReceptionSubmit} className="animate-fade-in">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>Nome Completo</label>
                    <input type="text" className="input-field" value={fullName} onChange={e => setFullName(e.target.value)} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>CPF</label>
                      <input type="text" className="input-field" value={cpf} onChange={e => setCpf(e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>Plano de Saúde</label>
                      <input type="text" className="input-field" value={healthPlan} onChange={e => setHealthPlan(e.target.value)} required />
                    </div>
                  </div>
                </div>
                <button type="submit" className="btn" style={{ width: '100%' }}>Encaminhar para Médico</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ======================= MÉDICO (ATENDIMENTO) ======================= */}
      {currentRole === 'MÉDICO' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ marginTop: 0 }}>Fila de Espera</h3>
            {patients.filter(p => p.status === 'WAITING_DOCTOR').length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nenhum paciente aguardando consulta.</p>
            ) : (
              patients
                .filter(p => p.status === 'WAITING_DOCTOR')
                // Basic priority sort just for UI feel (real sort would use weights)
                .sort((a,b) => (a.suggestedRisk === 'Vermelho' ? -1 : 1))
                .map(p => (
                <div 
                  key={p.id} 
                  className={`patient-card ${selectedForDoctor?.id === p.id ? 'active' : ''}`}
                  onClick={() => setSelectedForDoctor(p)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong>{p.fullName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Convênio: {p.healthPlan}</span>
                    {renderBadge(p.suggestedRisk)}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="glass-panel" style={{ padding: '24px', overflowY: 'auto', maxHeight: '70vh' }}>
            {!selectedForDoctor ? (
              <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-secondary)' }}>
                Selecione um paciente na fila para iniciar o atendimento.
              </div>
            ) : (
              <div className="animate-fade-in">
                <h2 style={{ marginTop: 0, color: '#fff' }}>Atendimento: {selectedForDoctor.fullName}</h2>
                <div style={{ display: 'flex', gap: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  <span>CPF: {selectedForDoctor.cpf}</span>
                  <span>Plano: {selectedForDoctor.healthPlan}</span>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)' }}>Risco Sugerido (IA): {renderBadge(selectedForDoctor.suggestedRisk)}</h4>
                  
                  {/* Dados Clínicos mascarados */}
                  <div style={{ fontSize: '0.85rem' }}>
                    <strong style={{color: '#58a6ff'}}>Sintomas (Extraídos):</strong> {selectedForDoctor.extractedData?.symptoms?.join(', ')}<br/><br/>
                    <strong style={{color: '#58a6ff'}}>Relato Bruto (Mascarado):</strong><br/>
                    <span style={{ color: 'var(--text-secondary)' }}>{selectedForDoctor.symptomsText}</span>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                  <h3 style={{ margin: '0 0 16px 0' }}>Decisão Médica (Human-in-the-Loop)</h3>
                  <form onSubmit={handleDoctorSubmit}>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="radio" name="action" checked={resumeAction === 'approve'} onChange={() => setResumeAction('approve')} />
                        Aprovar Risco ({selectedForDoctor.suggestedRisk})
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="radio" name="action" checked={resumeAction === 'reject'} onChange={() => setResumeAction('reject')} />
                        Alterar Risco
                      </label>
                    </div>
                    
                    {resumeAction === 'reject' && (
                      <div style={{ marginBottom: '16px' }}>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="Justificativa da alteração..." 
                          value={resumeReason}
                          onChange={e => setResumeReason(e.target.value)}
                          required
                        />
                      </div>
                    )}
                    
                    <button type="submit" className="btn" disabled={doctorLoading} style={{ width: '100%', background: resumeAction === 'approve' ? '#238636' : '#d29922' }}>
                      {doctorLoading ? 'Gerando SOAP...' : 'Finalizar Atendimento e Gerar Prontuário'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMPLETED RECORDS (just to show off) */}
      {patients.filter(p => p.status === 'COMPLETED').length > 0 && currentRole === 'MÉDICO' && (
        <div className="glass-panel animate-fade-in" style={{ marginTop: '24px', padding: '24px' }}>
          <h3 style={{ marginTop: 0 }}>Prontuários Finalizados (SOAP)</h3>
          {patients.filter(p => p.status === 'COMPLETED').map(p => (
            <div key={p.id} style={{ background: 'rgba(88, 166, 255, 0.05)', border: '1px solid rgba(88, 166, 255, 0.2)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <strong style={{ color: '#58a6ff' }}>{p.fullName}</strong>
                {renderBadge(p.suggestedRisk)}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {p.soapSummary}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================= QA HARNESS (METRICS) ======================= */}
      {currentRole === 'QA HARNESS' && (
        <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Validação Automatizada de IA (Harness)</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Avaliação determinística de acurácia sobre um dataset padrão, sem intervenção humana.</p>
            </div>
            <button onClick={handleRunQA} className="btn" disabled={qaLoading} style={{ background: '#a371f7' }}>
              {qaLoading ? 'Executando Dataset...' : 'Rodar Avaliação (Dataset Local)'}
            </button>
          </div>

          {qaMetrics && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{qaMetrics.total_cases}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Casos de Teste</div>
                </div>
                <div style={{ background: 'rgba(35, 134, 54, 0.1)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#56d364' }}>{qaMetrics.passed}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Passaram</div>
                </div>
                <div style={{ background: 'rgba(218, 54, 51, 0.1)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff7b72' }}>{qaMetrics.failed}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Falharam</div>
                </div>
                <div style={{ background: qaMetrics.accuracy_percent > 90 ? 'rgba(35, 134, 54, 0.1)' : 'rgba(210, 153, 34, 0.1)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: qaMetrics.accuracy_percent > 90 ? '#56d364' : '#e3b341' }}>{qaMetrics.accuracy_percent}%</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Acurácia</div>
                </div>
              </div>

              <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Relatório por Caso</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {qaResults.map((res, i) => (
                  <div key={i} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '16px', 
                    background: 'rgba(0,0,0,0.2)', 
                    borderLeft: `4px solid ${res.passed ? '#238636' : '#da3633'}`,
                    borderRadius: '0 8px 8px 0'
                  }}>
                    <div>
                      <strong style={{ display: 'block', marginBottom: '4px' }}>{res.case_id} - {res.description}</strong>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Esperado: {renderBadge(res.expected_risk)} | Previsto pela IA: {renderBadge(res.predicted_risk)}
                      </div>
                    </div>
                    <div>
                      {res.passed ? (
                        <span style={{ color: '#56d364', fontWeight: 'bold' }}>✓ PASSOU</span>
                      ) : (
                        <span style={{ color: '#ff7b72', fontWeight: 'bold' }}>✗ FALHOU</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
