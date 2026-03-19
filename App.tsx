import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Upload, 
  FileText, 
  Download, 
  Volume2, 
  Brain, 
  Zap, 
  ShieldAlert,
  Loader2,
  ChevronRight,
  X
} from 'lucide-react';
import OpenAI from 'openai';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';

// --- Types ---
interface CampaignData {
  objective: string;
  audience: string;
  voice: string;
  tone: string;
  images: string[];
}

interface AnalysisResult {
  title: string;
  summary: string;
  stages: {
    name: string;
    description: string;
    tactic: string;
  }[];
  conclusion: string;
}

// --- Constants ---
const LE_BON_PRINCIPLES = `
Fundamentos de Gustave Le Bon (Psicología de las Masas, 1895):
1. Impulsividad e Irritabilidad: Las masas son guiadas por el inconsciente, no por la razón.
2. Sugestionabilidad y Credulidad: Las masas piensan en imágenes y aceptan fórmulas simples sin crítica.
3. Exageración de Sentimientos: Los sentimientos son simples, extremos y contagiosos.
4. Intolerancia y Conservadurismo: Respeto por la fuerza y la tradición; odio a la novedad radical.
5. Prestigio: La autoridad emana del prestigio del líder (adquirido o personal).
6. Afirmación, Repetición, Contagio: Los tres pilares de la persuasión técnica.
`;

export default function App() {
  const [step, setStep] = useState<'input' | 'processing' | 'output'>('input');
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState<CampaignData>({
    objective: '',
    audience: '',
    voice: 'autoritaria',
    tone: '',
    images: []
  });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- DeepSeek Integration ---
  const openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY!,
    baseURL: "https://api.deepseek.com",
    dangerouslyAllowBrowser: true
  });

  const processCampaign = async () => {
    setLoading(true);
    setStep('processing');

    try {
      const prompt = `
        Actúa como un "Arquitecto de Consenso" experto en la obra de Gustave Le Bon.
        Analiza los siguientes datos de campaña y genera una estrategia técnica de propaganda.
        
        DATOS DE CAMPAÑA:
        - Objetivo: ${campaign.objective}
        - Audiencia: ${campaign.audience}
        - Voz del Conductor: ${campaign.voice}
        - Tono: ${campaign.tone}
        
        ${LE_BON_PRINCIPLES}
        
        Genera un análisis estructurado en JSON con el siguiente esquema:
        {
          "title": "Título impactante de la estrategia",
          "summary": "Resumen ejecutivo del análisis de la multitud",
          "stages": [
            { "name": "Fase 1: Sugestión Inicial", "description": "...", "tactic": "..." },
            { "name": "Fase 2: Afirmación y Repetición", "description": "...", "tactic": "..." },
            { "name": "Fase 3: Contagio Colectivo", "description": "...", "tactic": "..." }
          ],
          "conclusion": "Dictamen final sobre la viabilidad del consenso"
        }

        Responde ÚNICAMENTE con el JSON, sin texto adicional.
      `;

      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "Eres un experto en psicología de masas y propaganda." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const data = JSON.parse(response.choices[0].message.content || '{}');
      setResult(data);
      setStep('output');
    } catch (error) {
      console.error("Error processing campaign:", error);
      alert("Error en el procesamiento estratégico. Verifique su conexión y API key.");
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  // --- TTS usando Web Speech API ---
  const playAudioSummary = () => {
    if (!result || audioPlaying) return;
    
    const textToSpeak = `Resumen estratégico: ${result.summary}. Conclusión: ${result.conclusion}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'es-ES';
    utterance.rate = 0.9;
    
    if (campaign.voice === 'autoritaria') {
      utterance.pitch = 0.8;
      utterance.rate = 0.8;
    } else if (campaign.voice === 'paternal') {
      utterance.pitch = 1.1;
      utterance.rate = 0.9;
    } else {
      utterance.pitch = 1.2;
      utterance.rate = 1.0;
    }
    
    setAudioPlaying(true);
    utterance.onend = () => setAudioPlaying(false);
    window.speechSynthesis.speak(utterance);
  };

  // --- Camera Logic ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
      alert("No se pudo acceder a la cámara.");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/png');
        setCampaign(prev => ({ ...prev, images: [...prev.images, dataUrl] }));
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  // --- File Logic ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCampaign(prev => ({ ...prev, images: [...prev.images, reader.result as string] }));
      };
      reader.readAsDataURL(file);
    });
  };

  // --- Export Logic ---
  const exportTXT = () => {
    if (!result) return;
    const content = `
PSIQUE-MASAS: ANÁLISIS ESTRATÉGICO
----------------------------------
TÍTULO: ${result.title}
RESUMEN: ${result.summary}

ESTRATEGIAS:
${result.stages.map(s => `- ${s.name}: ${s.description}\nTáctica: ${s.tactic}`).join('\n\n')}

CONCLUSIÓN: ${result.conclusion}
    `;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analisis-multitud.txt';
    a.click();
  };

  const exportPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("PSIQUE-MASAS: Análisis Estratégico", 10, 20);
    doc.setFontSize(12);
    doc.text(`Título: ${result.title}`, 10, 30);
    doc.text(`Resumen: ${doc.splitTextToSize(result.summary, 180)}`, 10, 40);
    
    let y = 60;
    result.stages.forEach(s => {
      doc.setFont("helvetica", "bold");
      doc.text(s.name, 10, y);
      doc.setFont("helvetica", "normal");
      y += 7;
      doc.text(doc.splitTextToSize(s.description, 180), 10, y);
      y += 15;
    });

    doc.save('analisis-multitud.pdf');
  };

  return (
    <div className="min-h-screen technical-grid p-4 md:p-8">
      <div className="scanline" />
      
      {/* Header */}
      <header className="max-w-5xl mx-auto mb-8 border-b-2 border-ink pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-4xl md:text-6xl font-serif font-bold tracking-tighter uppercase">
            PSIQUE-MASAS
          </h1>
          <p className="label-micro mt-2">Arquitecto de Consenso: Análisis Técnico de la Mente Colectiva</p>
        </div>
        <div className="hidden md:block text-right">
          <p className="label-micro">Versión 1.0.895</p>
          <p className="text-xs font-mono">ESTADO: {loading ? 'PROCESANDO...' : 'SISTEMA LISTO'}</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {step === 'input' && (
            <motion.section 
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="brutalist-card p-6 md:p-8"
            >
              <div className="flex items-center gap-2 mb-6 border-b border-ink/10 pb-2">
                <Brain className="w-5 h-5" />
                <h2 className="text-xl font-bold uppercase tracking-tight">Configuración de Campaña</h2>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); processCampaign(); }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="label-micro">Objetivo de la Campaña</label>
                    <input 
                      required
                      className="brutalist-input"
                      placeholder="Ej. Modificación de conducta de consumo"
                      value={campaign.objective}
                      onChange={e => setCampaign({...campaign, objective: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="label-micro">Audiencia Objetivo</label>
                    <input 
                      required
                      className="brutalist-input"
                      placeholder="Ej. Población urbana sub-30"
                      value={campaign.audience}
                      onChange={e => setCampaign({...campaign, audience: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="label-micro">Voz del Conductor</label>
                    <select 
                      className="brutalist-input"
                      value={campaign.voice}
                      onChange={e => setCampaign({...campaign, voice: e.target.value})}
                    >
                      <option value="autoritaria">Autoritaria / Dogmática</option>
                      <option value="paternal">Paternalista / Protectora</option>
                      <option value="visionaria">Visionaria / Mística</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="label-micro">Estilo y Tono</label>
                    <input 
                      required
                      className="brutalist-input"
                      placeholder="Ej. Seco, Directo, Imperativo"
                      value={campaign.tone}
                      onChange={e => setCampaign({...campaign, tone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="label-micro">Insumos Multimedia (Imágenes de Referencia)</label>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      className="brutalist-button flex items-center gap-2 text-sm"
                    >
                      <Upload className="w-4 h-4" /> Cargar Archivos
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      hidden 
                      multiple 
                      accept="image/*" 
                      onChange={handleFileUpload}
                    />
                    
                    <button 
                      type="button" 
                      onClick={startCamera}
                      className="brutalist-button flex items-center gap-2 text-sm"
                    >
                      <Camera className="w-4 h-4" /> Activar Cámara
                    </button>
                  </div>

                  {cameraActive && (
                    <div className="relative brutalist-card overflow-hidden aspect-video bg-black">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                        <button type="button" onClick={capturePhoto} className="brutalist-button bg-accent text-ink border-ink">
                          CAPTURAR
                        </button>
                        <button type="button" onClick={stopCamera} className="brutalist-button">
                          CANCELAR
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {campaign.images.map((img, i) => (
                      <div key={i} className="relative w-20 h-20 brutalist-card overflow-hidden">
                        <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button 
                          type="button"
                          onClick={() => setCampaign(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== i) }))}
                          className="absolute top-0 right-0 bg-ink text-white p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full brutalist-button bg-accent text-ink py-4 text-lg font-bold tracking-widest hover:bg-white transition-colors uppercase"
                >
                  INICIAR PROCESAMIENTO ESTRATÉGICO
                </button>
              </form>
            </motion.section>
          )}

          {step === 'processing' && (
            <motion.div 
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="brutalist-card p-12 flex flex-col items-center justify-center space-y-6 text-center"
            >
              <Loader2 className="w-12 h-12 animate-spin text-accent" />
              <div className="space-y-2">
                <h2 className="text-2xl font-bold uppercase">Analizando la Multitud</h2>
                <p className="font-mono text-sm opacity-60">Sincronizando con principios de Le Bon (1895)...</p>
              </div>
              <div className="w-full max-w-xs bg-ink/10 h-1 overflow-hidden">
                <motion.div 
                  className="bg-accent h-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 5, repeat: Infinity }}
                />
              </div>
            </motion.div>
          )}

          {step === 'output' && result && (
            <motion.section 
              key="output"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="brutalist-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold uppercase tracking-tight">Análisis de la Multitud</h2>
                  <p className="label-micro">Dictamen Estratégico Generado</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={exportPDF} className="brutalist-button flex items-center gap-2 text-xs">
                    <FileText className="w-4 h-4" /> PDF
                  </button>
                  <button onClick={exportTXT} className="brutalist-button flex items-center gap-2 text-xs">
                    <Download className="w-4 h-4" /> TXT
                  </button>
                  <button 
                    onClick={playAudioSummary} 
                    disabled={audioPlaying}
                    className={`brutalist-button flex items-center gap-2 text-xs ${audioPlaying ? 'bg-accent text-ink' : ''}`}
                  >
                    <Volume2 className={`w-4 h-4 ${audioPlaying ? 'animate-pulse' : ''}`} /> 
                    {audioPlaying ? 'ESCUCHANDO...' : 'ESCUCHAR RESUMEN'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="brutalist-card p-6">
                    <div className="flex justify-between items-center mb-4 border-b border-ink pb-2">
                      <h3 className="text-xl font-bold italic serif-italic">
                        {result.title}
                      </h3>
                      <span className="label-micro opacity-50">
                        Extensión: {result.summary.split(/\s+/).length + result.stages.reduce((acc, s) => acc + s.description.split(/\s+/).length, 0)} palabras
                      </span>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{result.summary}</ReactMarkdown>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {result.stages.map((stage, i) => (
                      <div key={i} className="brutalist-card p-4 space-y-3 relative overflow-hidden group">
                        <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
                          <Zap className="w-16 h-16" />
                        </div>
                        <span className="label-micro text-accent">Fase {i + 1}</span>
                        <h4 className="font-bold uppercase text-sm leading-tight">{stage.name}</h4>
                        <p className="text-xs opacity-80 leading-relaxed">{stage.description}</p>
                        <div className="pt-2 border-t border-ink/10">
                          <p className="label-micro text-[9px]">Táctica Técnica</p>
                          <p className="text-[11px] font-mono italic">{stage.tactic}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="brutalist-card p-6 bg-ink text-white">
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldAlert className="w-5 h-5 text-accent" />
                      <h3 className="font-bold uppercase tracking-wider">Dictamen Final</h3>
                    </div>
                    <p className="text-sm italic leading-relaxed">
                      "{result.conclusion}"
                    </p>
                  </div>

                  <div className="brutalist-card p-6">
                    <h3 className="label-micro mb-4">Métricas de Influencia</h3>
                    <div className="space-y-4">
                      {[
                        { label: 'Sugestionabilidad', val: 85 },
                        { label: 'Contagio Emocional', val: 92 },
                        { label: 'Unidad Mental', val: 78 }
                      ].map((m, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span>{m.label}</span>
                            <span>{m.val}%</span>
                          </div>
                          <div className="w-full bg-ink/10 h-1.5">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${m.val}%` }}
                              className="bg-ink h-full"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => setStep('input')}
                    className="w-full brutalist-button flex items-center justify-center gap-2"
                  >
                    NUEVO ANÁLISIS <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-5xl mx-auto mt-12 pt-8 border-t border-ink/20 flex flex-col md:flex-row justify-between gap-4 opacity-60">
        <div className="text-xs font-mono">
          <p>[EJERCICIO ACADÉMICO: PROPAGANDA]</p>
          <p>Fundamentado en "Psicología de las Masas" de Gustave Le Bon (1895)</p>
        </div>
        <div className="text-xs text-right italic serif-italic">
          "La masa es un rebaño servil, incapaz de estar sin un amo."
        </div>
      </footer>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}