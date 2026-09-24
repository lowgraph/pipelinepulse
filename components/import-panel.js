'use client';
import { useLanguage, LanguageToggle } from '../components/language';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, CheckCheck, ChevronDown, FileCheck2, GitMerge, LoaderCircle, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import { analyze, decodeCSV, inspectCSV, resolveMappings, MAX_BYTES } from '../lib/pipeline';

const defaults = { currency: 'auto', decimal: 'auto', adsDateOrder: 'auto', crmDateOrder: 'auto', adsMapping: {}, crmMapping: {}, statusMapping: {} };
function detect(file, kind, mapping) { if (!file) return null; try { return inspectCSV(file.text, kind, mapping); } catch (error) { return { error: error.message, headers: [], columns: {}, missing: [], ambiguous: [] }; } }
function UploadSlot({ kind, file, detection, onFile, error, reading }) {
  const { t } = useLanguage();
  const input = useRef(null); const [drag, setDrag] = useState(false);
  return <div className={`inline-upload ${drag ? 'drag' : ''} ${file ? 'loaded' : ''}`} onDragOver={event => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={event => { event.preventDefault(); setDrag(false); onFile(event.dataTransfer.files[0]); }}>
    <div className="upload-icon">{reading ? <LoaderCircle size={23} className="spin" /> : file ? <FileCheck2 size={23} /> : <Upload size={23} />}</div>
    <div className="upload-content"><h3>{kind === 'ads' ? t("Advertising CSV") : t("CRM CSV")}</h3><p>{file ? file.name : kind === 'ads' ? 'Google Ads / Meta' : 'Salesforce / HubSpot'}</p></div>
    <button className="button secondary" disabled={reading} onClick={() => input.current.click()}>{file ? t("Replace") : t("Choose file")}</button>
    <input ref={input} type="file" aria-label={`${kind} CSV file`} accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" hidden onChange={event => { onFile(event.target.files[0]); event.target.value = ''; }} />
    {detection && !detection.error && <div className="detection-result"><span><CheckCheck size={14} />{detection.rows} {t("rows")} · {t(detection.delimiter)} · {file.encoding}</span>{(kind === 'ads' ? ['spend', 'campaign'] : ['id', 'revenue', 'campaign']).map(field => <span key={field} className={field !== 'id' && !detection.columns[field] && !(field === 'campaign' && detection.columns.campaignId) ? 'missing-field' : ''}>{t(field)}: <strong>{detection.columns[field] || (field === 'campaign' && detection.columns.campaignId) || (field === 'id' ? t("Optional · deduplicating by row contents") : field === 'revenue' ? t("Not detected · choose the amount column below") : t("Choose a column below"))}</strong></span>)}</div>}
    {(error || detection?.error) && <p className="upload-error" role="alert">{t(error || detection.error)}</p>}
  </div>;
}
export default function ImportPanel({ onAnalyze, onReset }) {
  const { t } = useLanguage();
  const [files, setFiles] = useState({ ads: null, crm: null }); const [options, setOptions] = useState(defaults);
  const [errors, setErrors] = useState({}); const [reading, setReading] = useState({}); const [busy, setBusy] = useState(false); const [settingsOpen, setSettingsOpen] = useState(false);
  const version = useRef({ ads: 0, crm: 0 });
  const detections = useMemo(() => { const mapped = files.ads && files.crm ? resolveMappings(files.ads.text, files.crm.text, options) : options; return { ads: detect(files.ads, 'ads', mapped.adsMapping), crm: detect(files.crm, 'crm', mapped.crmMapping) }; }, [files, options]);
  const needsMapping = Object.values(detections).some(d => d && (d.missing.length || d.ambiguous.length || d.unknownStages?.length || d.ambiguousDates)) || !!(detections.crm && !detections.crm.columns.revenue);
  useEffect(() => { if (needsMapping) setSettingsOpen(true); }, [needsMapping]);
  async function read(kind, file) {
    if (!file) return;
    const revision = ++version.current[kind];
    setReading(prev => ({ ...prev, [kind]: true })); setFiles(prev => ({ ...prev, [kind]: null })); setErrors(prev => ({ ...prev, [kind]: null, general: null }));
    try {
      if (!/\.(csv|tsv|txt)$/i.test(file.name)) throw new Error('Choose a CSV, TSV, or delimited text export.');
      if (file.size > MAX_BYTES) throw new Error('File exceeds the 5 MB limit.');
      const decoded = decodeCSV(await file.arrayBuffer()); if (revision !== version.current[kind]) return;
      setFiles(prev => ({ ...prev, [kind]: { name: file.name, ...decoded } }));
      setOptions(prev => ({ ...prev, [`${kind}Mapping`]: {}, ...(kind === 'crm' ? { statusMapping: {} } : {}) }));
    } catch (error) { if (revision === version.current[kind]) setErrors(prev => ({ ...prev, [kind]: error.message })); }
    finally { if (revision === version.current[kind]) setReading(prev => ({ ...prev, [kind]: false })); }
  }
  async function submit() {
    setBusy(true); setErrors({}); await new Promise(resolve => setTimeout(resolve, 20));
    try { const model = analyze(files.ads.text, files.crm.text, options);
      if (!model.stats.acceptedAds || !model.stats.acceptedCrm) throw new Error(`No usable ${!model.stats.acceptedAds ? 'advertising' : 'CRM'} rows. ${model.issues.find(issue => issue.source === (!model.stats.acceptedAds ? 'ads' : 'crm'))?.reason || 'Review the detected columns.'} Previous results are unchanged.`);
      onAnalyze(model, { ads: files.ads.text, crm: files.crm.text, settings: options, names: { ads: files.ads.name, crm: files.crm.name } }); setSettingsOpen(false);
    } catch (error) { setErrors({ general: error.message }); setSettingsOpen(true); }
    finally { setBusy(false); }
  }
  function reset() { version.current.ads++; version.current.crm++; setFiles({ ads: null, crm: null }); setReading({}); setOptions(defaults); setErrors({}); setSettingsOpen(false); onReset(); }
  return <section id="import" className="panel import-panel"><div className="panel-heading"><div><h2>{t("Bring your data together")}</h2><p>{t("Drop in your exports. We detect the format and connect spend to revenue.")}</p></div><span className="local-note"><ShieldCheck size={14} />{t("Processed in your browser")}</span></div>
    <div className="upload-grid">{['ads', 'crm'].map(kind => <UploadSlot key={kind} kind={kind} file={files[kind]} detection={detections[kind]} error={errors[kind]} reading={reading[kind]} onFile={file => read(kind, file)} />)}</div>
    <div className="import-actions"><div className="import-links"><button className="text-button" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}>{t("Detection settings")}{' '}<ChevronDown size={14} /></button><button className="text-button" onClick={reset}><RotateCcw size={13} />{t("Clear data")}</button></div><button className="button primary" disabled={!files.ads || !files.crm || busy || reading.ads || reading.crm} onClick={submit}>{busy ? <LoaderCircle size={17} className="spin" /> : <GitMerge size={17} />}{busy ? t("Reconciling…") : t("Analyze data")}</button></div>
    {settingsOpen && <div className="detection-settings"><p className="settings-intro">{t("Common formats are automatic. Confirm ambiguous dates or custom fields here. Unknown fields are never silently guessed.")}</p><div className="form-row"><label>{t("Reporting currency")}<select value={options.currency} onChange={event => setOptions({ ...options, currency: event.target.value })}><option value="auto">{t("Auto-detect · USD if unspecified")}</option>{['USD', 'BRL', 'EUR', 'GBP', 'CAD', 'AUD'].map(code => <option key={code}>{code}</option>)}</select></label><label>{t("Number format")}<select value={options.decimal} onChange={event => setOptions({ ...options, decimal: event.target.value })}><option value="auto">{t("Auto-detect per value")}</option><option value=".">{t("1,234.56 · decimal point")}</option><option value=",">{t("1.234,56 · decimal comma")}</option></select></label></div>
    <div className="mapping-grid">{['ads', 'crm'].map(kind => <div key={kind}><h3>{kind === 'ads' ? t("Advertising fields") : t("CRM fields")}</h3>{detections[kind]?.missing.length > 0 && <p className="error-text">{t("Select:")}{' '}{detections[kind].missing.join(', ')}</p>}{detections[kind]?.ambiguous.length > 0 && <p className="error-text">{t("Ambiguous:")}{' '}{detections[kind].ambiguous.join(', ')}</p>}
      {(kind === 'ads' ? ['campaignId', 'campaign', 'spend', 'date', 'currency'] : ['id', 'campaignId', 'campaign', 'status', 'revenue', 'date', 'currency']).map(field => <label key={field}>{t(field.replace(/([A-Z])/g, ' $1'))}<select aria-label={`${kind} ${field} column`} value={options[`${kind}Mapping`][field] || ''} onChange={event => setOptions({ ...options, [`${kind}Mapping`]: { ...options[`${kind}Mapping`], [field]: event.target.value } })}><option value="">{detections[kind]?.columns[field] ? `${t("Detected:")} ${detections[kind].columns[field]}` : t("Auto-detect")}</option>{detections[kind]?.headers.map(header => <option key={header}>{header}</option>)}</select></label>)}
      <label>{t("Date order")}<select aria-label={`${kind} date order`} value={options[`${kind}DateOrder`]} onChange={event => setOptions({ ...options, [`${kind}DateOrder`]: event.target.value })}><option value="auto">{t("Auto-detect from this file")}</option><option value="dmy">{t("Day / month / year")}</option><option value="mdy">{t("Month / day / year")}</option></select></label>{detections[kind]?.ambiguousDates > 0 && <p className="settings-hint">{t("Some dates need a date-order choice or correction.")}</p>}
    </div>)}</div>
    {detections.crm?.unknownStages?.length > 0 && <div className="stage-mapping"><h3>{t("Custom CRM stages")}</h3><p>{t("Choose their meaning. Unmapped stages are quarantined.")}</p>{detections.crm.unknownStages.map(stage => <label key={stage}>{stage}<select aria-label={`Stage ${stage}`} value={options.statusMapping[stage] || ''} onChange={event => setOptions({ ...options, statusMapping: { ...options.statusMapping, [stage]: event.target.value } })}><option value="">{t("Needs review")}</option><option value="won">{t("Closed won")}</option><option value="open">{t("Open pipeline")}</option><option value="lost">{t("Closed lost")}</option></select></label>)}</div>}
    <div className="field-previews">{['ads', 'crm'].map(kind => detections[kind] && <details key={kind}><summary>{t(kind === 'ads' ? 'Inspect advertising columns and sample values' : 'Inspect CRM columns and sample values')}</summary><div className="table-scroll"><table><thead><tr><th>{t("Column in your file")}</th><th>{t("Sample values")}</th></tr></thead><tbody>{Object.entries(detections[kind].examples || {}).map(([header, values]) => <tr key={header}><td>{header}</td><td>{values.join(' · ')}</td></tr>)}</tbody></table></div></details>)}</div>
    <p className="settings-hint">{t("Detects headers, column types, and unique campaign values shared by both files. Supports decimal commas/points, currency affixes, spaces, and apostrophe grouping. One separator followed by three digits means thousands (1.234 → 1,234). Ambiguous dates such as 03/04/2026 need evidence or your choice.")}</p></div>}
    {errors.general && <div className="error-banner" role="alert">{t(errors.general)}</div>}
  </section>;
}
