const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src/app/globals.css');
let css = fs.readFileSync(cssPath, 'utf8');

// The goal is to add a comprehensive mobile media query at the end of the file.
const mobileStyles = `
/* ═══════════════════════════════════════════════════════════════
   Mobile Typography & Layout Adjustments
   ═══════════════════════════════════════════════════════════════ */
@media (max-width: 768px) {
  .dashboard-hero h1 { font-size: 32px; }
  .dashboard-hero p { font-size: 18px; }
  .action-card-label { font-size: 18px; }
  .action-card-desc { font-size: 14px; line-height: 1.5; }
  .nav-link { font-size: 16px; padding: 10px 16px; }
  .navbar-brand { font-size: 18px; }
  .stat-value { font-size: 36px; }
  .stat-label { font-size: 14px; }
  .empty-state-text { font-size: 18px; }
  .review-panel-header h3 { font-size: 18px; }
  .review-type-badge { font-size: 13px; }
  .review-label { font-size: 12px; }
  .review-text-strike, .review-text-new { font-size: 16px; }
  .review-explanation { font-size: 14px; }
  .note-textarea { font-size: 16px; }
  .manuscript-block h3 { font-size: 18px; }
  .manuscript-paragraph { font-size: 18px; line-height: 1.6; }
  
  /* Increase padding for better touch targets */
  .action-card { padding: 24px 20px; }
  button { min-height: 44px; }
  .btn-primary, .btn-secondary, .btn-ghost { font-size: 16px; padding: 12px 20px; }
}
`;

if (!css.includes('Mobile Typography & Layout Adjustments')) {
  fs.writeFileSync(cssPath, css + '\n' + mobileStyles);
  console.log('Added mobile typography adjustments to globals.css');
} else {
  console.log('Already added');
}
