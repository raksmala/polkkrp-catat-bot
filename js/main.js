/* ============================================================
   KotaKita Discord Message Generator
   Pure vanilla JS — no frameworks, no build tools
   ============================================================ */

import './preview.js';
import { loadUndangUndang } from './pasal.js';
import { bindGlobalEvents } from './ui.js';

bindGlobalEvents();

await loadUndangUndang();
