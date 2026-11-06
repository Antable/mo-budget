import { useState, useEffect, useRef } from "react";

const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");
const DAYS_AR = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const STORAGE_PREFIX = "mo_budget_v3_";
const TEMPLATE_KEY = "mo_budget_template";
const DEBTS_KEY = "mo_budget_debts";

function monthKey(year, month) { return `${STORAGE_PREFIX}${year}_${month}`; }
function loadStore(year, month) { try { return JSON.parse(localStorage.getItem(monthKey(year, month))) || null; } catch { return null; } }
function saveStore(data) { localStorage.setItem(monthKey(data.year, data.month), JSON.stringify(data)); }
function loadTemplate() { try { return JSON.parse(localStorage.getItem(TEMPLATE_KEY)) || null; } catch { return null; } }
function saveTemplate(groups, workDaysCfg) { localStorage.setItem(TEMPLATE_KEY, JSON.stringify({ groups, workDaysCfg })); }
function loadDebts() { try { return JSON.parse(localStorage.getItem(DEBTS_KEY)) || []; } catch { return []; } }
function saveDebts(debts) { localStorage.setItem(DEBTS_KEY, JSON.stringify(debts)); }

function makeItem(label="بند", unitPrice="", times=1) {
  return { id:uid(), label, unitPrice, timesExpected:times, checkedBoxes:0, extraActual:0, checkedFull:false };
}

const DEFAULT_GROUPS = [
  { id:uid(), name:"البيت", icon:"🏠", budgetShare:"", items:[makeItem("مرة أساسية","2000",1), makeItem("مرة عند الحاجة","",1)] },
  { id:uid(), name:"استثمار أسهم", icon:"📈", budgetShare:"", items:[makeItem("استثمرت","",1)] },
  { id:uid(), name:"حالات طارئة", icon:"🚨", budgetShare:"", items:[makeItem("صندوق طوارئ","",1)] },
  { id:uid(), name:"تليفون", icon:"📱", budgetShare:"", items:[makeItem("شحن باقة","70",4)] },
  { id:uid(), name:"إنترنت البيت", icon:"🌐", budgetShare:"", items:[makeItem("فاتورة النت","",1)] },
  { id:uid(), name:"خروج وفسح", icon:"🎉", budgetShare:"", items:[makeItem("خروجة","500",2), makeItem("خروجة صغيرة","300",4)] },
