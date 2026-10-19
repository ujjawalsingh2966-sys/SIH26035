import { ReportDataset } from '../types/report';

export class HtmlGenerator {
  private static escapeHtml(str: string): string {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public static generate(report: ReportDataset): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OIML Test Report - ${this.escapeHtml(report.testCaseId)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 40px; color: #333; line-height: 1.6; }
    h1, h2, h3 { color: #2c3e50; }
    .disclaimer { border: 2px dashed #e74c3c; padding: 10px; color: #e74c3c; font-weight: bold; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #bdc3c7; padding: 8px; text-align: left; }
    th { background-color: #ecf0f1; }
    .seal { margin-top: 40px; padding: 20px; background-color: #f9f9f9; border: 1px solid #e1e4e8; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="disclaimer">
    ${this.escapeHtml(report.disclaimer)}
  </div>

  <h1>OIML R76 Test Report</h1>
  <p><strong>Report ID:</strong> ${this.escapeHtml(report.reportId)}</p>
  <p><strong>Test Case ID:</strong> ${this.escapeHtml(report.testCaseId)}</p>
  <p><strong>Status:</strong> ${this.escapeHtml(report.status)}</p>
  ${report.instrumentDetails ? `<p><strong>Instrument Model:</strong> ${this.escapeHtml(report.instrumentDetails.model)}</p>` : ''}

  <h2>Compliance Summary</h2>
  <section aria-label="Manufacturer and instrument specifications">
    <h2>Manufacturer and instrument specifications</h2>
    <p>Metadata source: ${this.escapeHtml(report.metadataSource)}${report.metadataSource === 'LEGACY_LIVE_REFERENCE' ? ' — legacy record has no historical snapshot; referenced master data is protected from editing.' : ' — frozen at test-case creation.'}</p>
    <table>${[
      ['Manufacturer', report.manufacturerDetails?.name], ['Address', report.manufacturerDetails?.address], ['Manufacturer identifier', report.manufacturerDetails?.identifier],
      ['Instrument', report.instrumentDetails?.name], ['Model', report.instrumentDetails?.model], ['Serial number', report.instrumentDetails?.serialNumber],
      ['Accuracy class', report.instrumentDetails?.accuracyClass], ['Max (g)', report.instrumentDetails?.maxCapacity], ['Min (g)', report.instrumentDetails?.minCapacity],
      ['e (g)', report.instrumentDetails?.e], ['d (g)', report.instrumentDetails?.d], ['n = Max/e', report.instrumentDetails?.n],
      ['Software identification', report.instrumentDetails?.softwareIdentification], ['Type approval mark (declared, not verified)', report.instrumentDetails?.typeApprovalMark],
      ['Technical characteristics', report.instrumentDetails?.technicalNotes], ['Tare device', report.instrumentDetails?.hasTare === undefined ? undefined : report.instrumentDetails.hasTare ? 'Yes' : 'No'],
      ['Configuration', report.instrumentDetails?.isElectronic && report.instrumentDetails?.isManual && report.instrumentDetails?.isSingleRange ? 'Electronic / non-automatic / single range' : 'Not fully recorded']
    ].map(([label, value]) => `<tr><th>${this.escapeHtml(label)}</th><td>${this.escapeHtml(value || 'Not recorded')}</td></tr>`).join('')}</table>
  </section>
  ${!report.programme.complete ? `<section aria-label="Incomplete test programme"><h2>INCOMPLETE — not a final compliance report</h2><ul>${report.programme.issues.map(issue => `<li>${this.escapeHtml(issue)}</li>`).join('')}</ul></section>` : ''}
  <table>
    <tr><th>Overall Verdict</th><td><strong>${this.escapeHtml(report.complianceSummary.overallVerdict)}</strong></td></tr>
    <tr><th>Weighing Test</th><td>${this.escapeHtml(report.complianceSummary.weighing)}</td></tr>
    <tr><th>Eccentricity Test</th><td>${this.escapeHtml(report.complianceSummary.eccentricity)}</td></tr>
    <tr><th>Repeatability Test</th><td>${this.escapeHtml(report.complianceSummary.repeatability)}</td></tr>
    <tr><th>Tare Test</th><td>${this.escapeHtml(report.complianceSummary.tare)}</td></tr>
    <tr><th>Zero-Setting Test</th><td>${this.escapeHtml(report.complianceSummary.zeroSetting)}</td></tr>
  </table>

  ${report.programme.native ? `<section aria-label="Native test applicability and results"><h2>Native procedure coverage (not a complete R76-2 report)</h2><p>${this.escapeHtml(report.programme.native.standard)} / ${this.escapeHtml(report.programme.native.ruleset)} / ${this.escapeHtml(report.programme.native.purpose)}</p>
  <table><tr><th>Procedure</th><th>Clauses</th><th>Applicability / completion</th><th>Explanation</th></tr>${report.programme.native.procedures.map(item => `<tr><td>${this.escapeHtml(item.name)}</td><td>${this.escapeHtml(item.clauses.join(', '))}</td><td>${this.escapeHtml(item.applicability)} / ${this.escapeHtml(item.status)}</td><td>${this.escapeHtml(item.reason)}</td></tr>`).join('')}</table>
  ${(report.nativeTests || []).map(test => `<h3>${this.escapeHtml(test.submission.procedureId)} / ${this.escapeHtml(test.submission.series)}: ${this.escapeHtml(test.result.status)}</h3><p>${this.escapeHtml(test.result.methodology)}</p><p>Spread: ${this.escapeHtml(test.result.spreadG || 'Not applicable')} g; limit: ${this.escapeHtml(test.result.limitG || 'Undetermined')} g</p><table><tr><th>No.</th><th>L (g)</th><th>I (g)</th><th>ΔL (g)</th><th>P (g)</th><th>E / E0 (g)</th><th>Limit (g)</th><th>Verdict</th></tr>${test.result.rows.map(row => `<tr>${[String(row.sequence),row.loadG,row.indicationG,row.additionalWeightsG,row.P,row.E,row.limitG,row.verdict].map(value => `<td>${this.escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</table><p>Evidence: ${this.escapeHtml(test.submission.evidenceReference)}</p>`).join('')}</section>` : ''}
  ${(report.nativeTests || []).filter(test => test.result.ruleset === 'W8LAB-R76-2006-P4A-1').map(test => `<section><h3>${this.escapeHtml(test.submission.procedureId)}: correction and chronology trace</h3><table><tr><th>No./position</th><th>Phase/time</th><th>E0 (g)</th><th>Ec (g)</th><th>Details</th></tr>${test.result.rows.map(row => `<tr>${[`${row.sequence} ${row.position || ''}`,`${row.phase || ''} ${row.timestamp || ''}`,row.E0 ?? 'N/A',row.Ec ?? 'N/A',row.details || ''].map(value => `<td>${this.escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</table><details><summary>Original observations and conditions</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${this.escapeHtml(JSON.stringify(test.submission,null,2))}</pre></details></section>`).join('')}
  <h2>Metrological Evaluation</h2>
  ${report.observationEvaluations.length === 0
    ? `<p><em>No evaluated observations recorded for this test case.</em></p>`
    : `<table>
    <tr>
      <th>Test</th><th>Applied Load</th><th>Indication</th><th>Add. Weights</th>
      <th>P</th><th>E</th><th>Ec</th><th>Load Multiplier (m)</th><th>MPE</th>
      <th>Verdict</th><th>Rule Version</th><th>Explainability</th>
    </tr>
    ${report.observationEvaluations.map(ev => `
    <tr>
      <td>${this.escapeHtml(ev.testType)} #${ev.sequence}</td>
      <td>${this.escapeHtml(ev.appliedLoad.value)} ${this.escapeHtml(ev.appliedLoad.unit)}</td>
      <td>${this.escapeHtml(ev.indication.value)} ${this.escapeHtml(ev.indication.unit)}</td>
      <td>${this.escapeHtml(ev.additionalWeights.value)} ${this.escapeHtml(ev.additionalWeights.unit)}</td>
      <td>${this.escapeHtml(ev.P.value)} ${this.escapeHtml(ev.P.unit)}</td>
      <td>${this.escapeHtml(ev.E.value)} ${this.escapeHtml(ev.E.unit)}</td>
      <td>${this.escapeHtml(ev.Ec.value)} ${this.escapeHtml(ev.Ec.unit)}</td>
      <td>${this.escapeHtml(ev.m)}</td>
      <td>${ev.mpe ? `${this.escapeHtml(ev.mpe.value)} ${this.escapeHtml(ev.mpe.unit)}` : 'N/A'}</td>
      <td><strong>${this.escapeHtml(ev.verdict)}</strong></td>
      <td>${this.escapeHtml(ev.ruleVersion)}</td>
      <td>${this.escapeHtml(ev.explainability)}</td>
    </tr>`).join('')}
  </table>`}

  <h2>Cryptographic Seal and Metadata</h2>
  <div class="seal">
    <p><strong>Generated At:</strong> ${this.escapeHtml(report.meta.generatedAt)}</p>
    <p><strong>Generated By (Role):</strong> ${this.escapeHtml(report.meta.generatedBy)}</p>
    <p><strong>Rule Engine Version:</strong> ${this.escapeHtml(report.meta.ruleEngineVersion)}</p>
    <p><strong>SHA-256 Seal:</strong> <code>${this.escapeHtml(report.meta.cryptographicSeal)}</code></p>
  </div>
</body>
</html>`;
  }
}
