import { useState, useEffect, useRef } from "react";

const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (n) => Number(n || 0).toLocaleString("ar-EG");
const DAYS_AR = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const STORAGE_KEY = "mo_budget_v3";

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
}
function saveStore(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

function makeItem(label = "بند", unitPrice = "", times = 1) {
  return { id: uid(), label, unitPrice, timesExpected: times, checkedBoxes: 0, extraActual: 0 };
}

function makeMonthData(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return { id: uid(), day: i + 1, dayName: DAYS_AR[d.getDay()], amount: "", note: "", isHoliday: [5,6].includes(d.getDay()) };
  });
  return {
    year, month,
    mode: "plan", // "plan" | "budget"
    totalBudget: "",
    groups: [
      { id: uid(), name: "البيت", icon: "🏠", budgetShare: "", items: [makeItem("مرة أساسية","2000",1), makeItem("مرة عند الحاجة","",1)] },
      { id: uid(), name: "استثمار أسهم", icon: "📈", budgetShare: "", items: [makeItem("استثمرت","",1)] },
      { id: uid(), name: "حالات طارئة", icon: "🚨", budgetShare: "", items: [makeItem("صندوق طوارئ","",1)] },
      { id: uid(), name: "تليفون", icon: "📱", budgetShare: "", items: [makeItem("شحن باقة","70",4)] },
      { id: uid(), name: "إنترنت البيت", icon: "🌐", budgetShare: "", items: [makeItem("فاتورة النت","",1)] },
      { id: uid(), name: "خروج وفسح", icon: "🎉", budgetShare: "", items: [makeItem("خروجة","500",2), makeItem("خروجة صغيرة","300",4)] },
      { id: uid(), name: "رياضة", icon: "🏸", budgetShare: "", items: [makeItem("بادل","190",4)] },
      { id: uid(), name: "شيء غير متوقع", icon: "⚡", budgetShare: "", items: [makeItem("طارئ","500",1)] },
      { id: uid(), name: "أمور حياتية أخرى", icon: "🌱", budgetShare: "", items: [makeItem("بند","",1)] },
    ],
    workDays: {
      id: uid(), transportExpected: "50", foodExpected: "50",
      days,
    },
  };
}

// ── item helpers ─────────────────────────────────────────────────────────────
function itemExpected(it) {
  return (parseFloat(it.unitPrice) || 0) * (parseInt(it.timesExpected) || 0);
}
function itemActual(it) {
  const fromBoxes = (parseFloat(it.unitPrice) || 0) * (it.checkedBoxes || 0);
  return fromBoxes + (parseFloat(it.extraActual) || 0);
}
function groupExpected(g) { return g.items.reduce((s, it) => s + itemExpected(it), 0); }
function groupActual(g) { return g.items.reduce((s, it) => s + itemActual(it), 0); }

// ── sub-components ───────────────────────────────────────────────────────────
function NumInput({ value, onChange, placeholder = "0", style = {} }) {
  return (
    <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.13)", borderRadius:8,
        color:"#fff", fontSize:13, padding:"5px 8px", width:"100%", fontFamily:"inherit", direction:"rtl", ...style }} />
  );
}
function TxtInput({ value, onChange, placeholder = "", style = {} }) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.13)", borderRadius:8,
        color:"#fff", fontSize:13, padding:"5px 8px", width:"100%", fontFamily:"inherit", direction:"rtl", ...style }} />
  );
}

// ── CheckBoxRow ───────────────────────────────────────────────────────────────
function CheckBoxRow({ item, onChange }) {
  const n = parseInt(item.timesExpected) || 0;
  if (n === 0) return null;

  function toggle(idx) {
    // clicking already-checked last box unchecks it; otherwise check up to idx+1
    const newCount = item.checkedBoxes === idx + 1 ? idx : idx + 1;
    onChange({ ...item, checkedBoxes: newCount });
  }

  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6, alignItems:"center" }}>
      {Array.from({ length: n }, (_, i) => {
        const checked = i < item.checkedBoxes;
        return (
          <button key={i} onClick={() => toggle(i)} style={{
            width:22, height:22, borderRadius:5, flexShrink:0, cursor:"pointer",
            background: checked ? "#4ECDC4" : "transparent",
            border: `2px solid ${checked ? "#4ECDC4" : "rgba(255,255,255,0.25)"}`,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            {checked && <span style={{ color:"#000", fontSize:11, fontWeight:900 }}>✓</span>}
          </button>
        );
      })}
      {item.checkedBoxes > 0 && (
        <span style={{ fontSize:11, color:"rgba(78,205,196,0.7)", marginRight:4 }}>
          {item.checkedBoxes}/{n} × {fmt(parseFloat(item.unitPrice)||0)} = {fmt((parseFloat(item.unitPrice)||0)*item.checkedBoxes)} ج
        </span>
      )}
    </div>
  );
}

// ── ItemRow ───────────────────────────────────────────────────────────────────
function ItemRow({ item, onChange, onDelete, mode }) {
  const expected = itemExpected(item);
  const actual = itemActual(item);
  const overBudget = actual > expected && expected > 0;

  return (
    <div style={{
      background: overBudget ? "rgba(255,107,107,0.07)" : item.checkedBoxes > 0 ? "rgba(78,205,196,0.06)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${overBudget ? "rgba(255,107,107,0.25)" : item.checkedBoxes > 0 ? "rgba(78,205,196,0.18)" : "rgba(255,255,255,0.06)"}`,
      borderRadius:10, padding:"9px 10px", marginBottom:7,
    }}>
      {/* label row */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
        <TxtInput value={item.label} onChange={v => onChange({ ...item, label:v })} placeholder="اسم البند" />
        <button onClick={onDelete} style={{
          background:"rgba(255,107,107,0.15)", border:"none", borderRadius:6,
          color:"#FF6B6B", cursor:"pointer", padding:"3px 7px", fontSize:12, flexShrink:0,
        }}>✕</button>
      </div>

      {/* numbers row */}
      <div style={{ display:"flex", gap:6, alignItems:"flex-end" }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginBottom:3 }}>سعر الوحدة</div>
          <NumInput value={item.unitPrice} onChange={v => onChange({ ...item, unitPrice:v })} />
        </div>
        {mode === "plan" && (
          <div style={{ width:54 }}>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginBottom:3 }}>× مرات</div>
            <NumInput value={item.timesExpected} onChange={v => onChange({ ...item, timesExpected:v, checkedBoxes: Math.min(item.checkedBoxes, parseInt(v)||0) })} />
          </div>
        )}
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginBottom:3 }}>زيادة يدوية</div>
          <NumInput value={item.extraActual || ""} onChange={v => onChange({ ...item, extraActual: parseFloat(v)||0 })} placeholder="0" style={{ borderColor: item.extraActual ? "rgba(255,230,109,0.4)" : undefined }} />
        </div>
        <div style={{ textAlign:"center", minWidth:52 }}>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginBottom:3 }}>متوقع</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>{fmt(expected)} ج</div>
        </div>
      </div>

      {/* checkboxes */}
      {mode === "plan" && <CheckBoxRow item={item} onChange={onChange} />}

      {/* actual summary */}
      {actual > 0 && (
        <div style={{ marginTop:6, fontSize:11, color: overBudget ? "#FF6B6B" : "#4ECDC4", textAlign:"left" }}>
          الفعلي: {fmt(actual)} ج {overBudget ? "⚠️ تجاوزت" : "✓"}
        </div>
      )}
    </div>
  );
}

// ── GroupCard ─────────────────────────────────────────────────────────────────
function GroupCard({ group, onChange, onDelete, mode, budgetShare, onBudgetShareChange }) {
  const [open, setOpen] = useState(true);
  const exp = groupExpected(group);
  const act = groupActual(group);
  const diff = exp - act;

  function updateItem(idx, updated) {
    onChange({ ...group, items: group.items.map((it,i) => i===idx ? updated : it) });
  }
  function addItem() { onChange({ ...group, items:[...group.items, makeItem()] }); }
  function removeItem(idx) { onChange({ ...group, items: group.items.filter((_,i)=>i!==idx) }); }

  const checkedCount = group.items.reduce((s,it) => s + (it.checkedBoxes||0), 0);
  const totalTimes = group.items.reduce((s,it) => s + (parseInt(it.timesExpected)||0), 0);

  return (
    <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:16, border:"1px solid rgba(255,255,255,0.08)", marginBottom:12, overflow:"hidden" }}>
      {/* header */}
      <div style={{ display:"flex", alignItems:"center", padding:"12px 14px", cursor:"pointer", gap:10 }} onClick={() => setOpen(o=>!o)}>
        <span style={{ fontSize:20 }}>{group.icon}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:14 }}>{group.name}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:2 }}>
            {mode==="plan" ? `${checkedCount}/${totalTimes} مرة` : ""} · فعلي {fmt(act)} ج
          </div>
        </div>
        <div style={{ textAlign:"left" }}>
          <div style={{ fontSize:13, fontWeight:700, color: diff>=0 ? "#4ECDC4" : "#FF6B6B" }}>
            {diff>=0?"+":""}{fmt(diff)} ج
          </div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>من {fmt(exp)} ج</div>
        </div>
        <span style={{ color:"rgba(255,255,255,0.3)", fontSize:16, marginRight:4 }}>{open?"▲":"▼"}</span>
      </div>

      {open && (
        <div style={{ padding:"0 14px 14px" }}>
          {/* name/icon/budget row */}
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <TxtInput value={group.icon} onChange={v=>onChange({...group,icon:v})} placeholder="🏠" style={{ width:44 }} />
            <TxtInput value={group.name} onChange={v=>onChange({...group,name:v})} placeholder="اسم المجموعة" />
            {mode==="budget" && (
              <NumInput value={budgetShare} onChange={onBudgetShareChange} placeholder="نصيب ج" style={{ width:90 }} />
            )}
          </div>

          {/* budget mode: show auto-calculated times per item */}
          {mode==="budget" && budgetShare && (
            <div style={{ background:"rgba(255,230,109,0.07)", border:"1px solid rgba(255,230,109,0.15)", borderRadius:10, padding:"8px 12px", marginBottom:10, fontSize:12, color:"rgba(255,230,109,0.8)" }}>
              ميزانية المجموعة: {fmt(budgetShare)} ج
            </div>
          )}

          {group.items.map((it,idx) => (
            <ItemRow key={it.id} item={it} mode={mode}
              onChange={updated => updateItem(idx, updated)}
              onDelete={() => removeItem(idx)} />
          ))}

          <button onClick={addItem} style={{
            width:"100%", padding:"8px", borderRadius:9,
            background:"rgba(255,255,255,0.04)", border:"1px dashed rgba(255,255,255,0.15)",
            color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:12, fontFamily:"inherit",
          }}>+ إضافة بند</button>

          <button onClick={onDelete} style={{
            marginTop:8, width:"100%", padding:"6px",
            background:"rgba(255,107,107,0.08)", border:"1px solid rgba(255,107,107,0.2)",
            borderRadius:8, color:"rgba(255,107,107,0.7)", cursor:"pointer", fontSize:11, fontFamily:"inherit",
          }}>🗑️ حذف المجموعة</button>
        </div>
      )}
    </div>
  );
}

// ── WorkDaysCard ──────────────────────────────────────────────────────────────
function WorkDaysCard({ workDays, onChange }) {
  const [open, setOpen] = useState(false);
  const totalActual = workDays.days.reduce((s,d) => s+(parseFloat(d.amount)||0), 0);
  const avgExp = (parseFloat(workDays.transportExpected)||0)+(parseFloat(workDays.foodExpected)||0);
  const workCount = workDays.days.filter(d=>!d.isHoliday&&parseFloat(d.amount)>0).length;

  function updateDay(idx,field,val) {
    onChange({ ...workDays, days: workDays.days.map((d,i)=>i===idx?{...d,[field]:val}:d) });
  }

  return (
    <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:16, border:"1px solid rgba(255,255,255,0.08)", marginBottom:12, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", padding:"12px 14px", cursor:"pointer", gap:10 }} onClick={()=>setOpen(o=>!o)}>
        <span style={{ fontSize:20 }}>🗓️</span>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:14 }}>أيام الشهر</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:2 }}>{workCount} يوم · متوسط {fmt(avgExp)} ج/يوم</div>
        </div>
        <div style={{ textAlign:"left" }}>
          <div style={{ fontSize:13, fontWeight:700 }}>{fmt(totalActual)} ج</div>
        </div>
        <span style={{ color:"rgba(255,255,255,0.3)", fontSize:16, marginRight:4 }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ padding:"0 14px 14px" }}>
          <div style={{ display:"flex", gap:8, marginBottom:12, background:"rgba(255,255,255,0.04)", padding:10, borderRadius:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>مواصلات/يوم</div>
              <NumInput value={workDays.transportExpected} onChange={v=>onChange({...workDays,transportExpected:v})} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>أكل/يوم</div>
              <NumInput value={workDays.foodExpected} onChange={v=>onChange({...workDays,foodExpected:v})} />
            </div>
            <div style={{ textAlign:"center", padding:"8px 4px" }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>المجموع</div>
              <div style={{ fontSize:14, fontWeight:700, color:"#FFE66D" }}>{fmt(avgExp)} ج</div>
            </div>
          </div>
          <div style={{ display:"grid", gap:6 }}>
            {workDays.days.map((d,idx) => (
              <div key={d.id} style={{
                display:"flex", alignItems:"center", gap:8,
                background: d.isHoliday?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.04)",
                borderRadius:9, padding:"7px 10px",
                border:`1px solid ${d.amount?"rgba(78,205,196,0.15)":"rgba(255,255,255,0.05)"}`,
                opacity: d.isHoliday&&!d.amount&&!d.note?0.5:1,
              }}>
                <div style={{ minWidth:26, textAlign:"center", fontSize:12, color:"rgba(255,255,255,0.5)" }}>{d.day}</div>
                <div style={{ fontSize:11, minWidth:50, color: d.isHoliday?"rgba(255,230,109,0.6)":"rgba(255,255,255,0.5)" }}>{d.dayName}</div>
                <div style={{ flex:1 }}>
                  <NumInput value={d.amount} onChange={v=>updateDay(idx,"amount",v)} placeholder={d.isHoliday?"إجازة":fmt(avgExp)} style={{ fontSize:12 }} />
                </div>
                <div style={{ flex:1.5 }}>
                  <TxtInput value={d.note} onChange={v=>updateDay(idx,"note",v)} placeholder="ملاحظة" style={{ fontSize:12 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────
function Summary({ data }) {
  const grpExp = data.groups.reduce((s,g)=>s+groupExpected(g),0);
  const grpAct = data.groups.reduce((s,g)=>s+groupActual(g),0);
  const wrkAct = data.workDays.days.reduce((s,d)=>s+(parseFloat(d.amount)||0),0);
  const avgExp = (parseFloat(data.workDays.transportExpected)||0)+(parseFloat(data.workDays.foodExpected)||0);
  const wrkCount = data.workDays.days.filter(d=>!d.isHoliday&&parseFloat(d.amount)>0).length;
  const wrkExp = avgExp * Math.max(wrkCount,1);

  const totalExp = grpExp + wrkExp;
  const totalAct = grpAct + wrkAct;
  const diff = totalExp - totalAct;
  const pct = totalExp>0?(totalAct/totalExp)*100:0;

  return (
    <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:18, padding:18, border:"1px solid rgba(255,255,255,0.1)", marginBottom:16 }}>
      <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:14, letterSpacing:1 }}>ملخص الشهر</div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
        <div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>المتوقع</div>
          <div style={{ fontSize:22, fontWeight:700 }}>{fmt(totalExp)} <span style={{ fontSize:11 }}>ج</span></div>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>الفعلي</div>
          <div style={{ fontSize:22, fontWeight:700, color:pct>100?"#FF6B6B":pct>80?"#FFE66D":"#4ECDC4" }}>{fmt(totalAct)} <span style={{ fontSize:11 }}>ج</span></div>
        </div>
        <div style={{ textAlign:"left" }}>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{diff>=0?"وفرت":"زيادة"}</div>
          <div style={{ fontSize:22, fontWeight:700, color:diff>=0?"#4ECDC4":"#FF6B6B" }}>{fmt(Math.abs(diff))} <span style={{ fontSize:11 }}>ج</span></div>
        </div>
      </div>
      <div style={{ height:8, background:"rgba(255,255,255,0.08)", borderRadius:4, overflow:"hidden" }}>
        <div style={{
          height:"100%", width:`${Math.min(pct,100)}%`, borderRadius:4, transition:"width 0.5s",
          background:pct>100?"#FF6B6B":pct>80?"linear-gradient(90deg,#FFE66D,#ff9f00)":"linear-gradient(90deg,#4ECDC4,#44b3aa)",
        }}/>
      </div>
      <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:6, textAlign:"center" }}>{pct.toFixed(1)}% من المتوقع</div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, fontSize:11, color:"rgba(255,255,255,0.35)" }}>
        <span>المجموعات: {fmt(grpAct)} ج</span>
        <span>أيام الشغل: {fmt(wrkAct)} ج</span>
      </div>
    </div>
  );
}

// ── palette for groups ────────────────────────────────────────────────────────
const COLORS = ["#6c5ce7","#4ECDC4","#FF6B6B","#FFE66D","#a29bfe","#fd79a8","#00b894","#e17055","#74b9ff","#55efc4"];

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ slices, size = 180 }) {
  const r = 70; const cx = size/2; const cy = size/2;
  const circumference = 2 * Math.PI * r;
  const total = slices.reduce((s,sl)=>s+sl.value,0);
  if(total===0) return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={24}/>
      <text x={cx} y={cy+5} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={12}>ادخل أرقام</text>
    </svg>
  );
  let offset = 0;
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={24}/>
      {slices.map((sl,i)=>{
        const pct = sl.value/total;
        const dash = pct*circumference;
        const gap = circumference - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={sl.color} strokeWidth={22}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset*circumference}
            strokeLinecap="butt"
          />
        );
        offset += pct;
        return el;
      })}
    </svg>
  );
}

// ── BudgetModePanel ───────────────────────────────────────────────────────────
function BudgetModePanel({ data, onTotalChange, onShareChange }) {
  const total = parseFloat(data.totalBudget)||0;
  const sharesSum = data.groups.reduce((s,g)=>s+(parseFloat(g.budgetShare)||0),0);
  const remaining = total - sharesSum;

  const slices = data.groups
    .map((g,i)=>({ label:g.name, icon:g.icon, value:parseFloat(g.budgetShare)||0, color:COLORS[i%COLORS.length] }))
    .filter(s=>s.value>0);

  return (
    <div style={{ background:"rgba(255,230,109,0.05)", border:"1px solid rgba(255,230,109,0.12)", borderRadius:18, padding:16, marginBottom:14 }}>
      <div style={{ fontSize:12, color:"rgba(255,230,109,0.7)", marginBottom:12 }}>💰 توزيع الميزانية الإجمالية</div>

      {/* total input */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>الميزانية الإجمالية (ج)</div>
        <NumInput value={data.totalBudget} onChange={onTotalChange} placeholder="مثال: 13000" style={{ fontSize:18, fontWeight:800, textAlign:"center" }} />
      </div>

      {/* donut + legend */}
      {total > 0 && (
        <>
          <div style={{ display:"flex", gap:14, alignItems:"center", marginBottom:14 }}>
            {/* donut */}
            <div style={{ position:"relative", flexShrink:0 }}>
              <DonutChart slices={slices} size={160} />
              <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center" }}>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>وُزِّع</div>
                <div style={{ fontSize:15, fontWeight:800, color: remaining<0?"#FF6B6B":remaining===0?"#4ECDC4":"#fff" }}>{fmt(sharesSum)}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>ج</div>
              </div>
            </div>

            {/* legend */}
            <div style={{ flex:1, display:"flex", flexDirection:"column", gap:5 }}>
              {slices.map((sl,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:10, height:10, borderRadius:3, background:sl.color, flexShrink:0 }}/>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.7)", flex:1 }}>{sl.icon} {sl.label}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:sl.color }}>{total>0?((sl.value/total)*100).toFixed(0):0}%</span>
                </div>
              ))}
              {remaining > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:10, height:10, borderRadius:3, background:"rgba(255,255,255,0.1)", flexShrink:0 }}/>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)", flex:1 }}>متبقي</span>
                  <span style={{ fontSize:11, color:"rgba(255,230,109,0.8)" }}>{((remaining/total)*100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* horizontal stacked bar */}
          <div style={{ marginBottom:12 }}>
            <div style={{ height:12, borderRadius:6, background:"rgba(255,255,255,0.07)", overflow:"hidden", display:"flex" }}>
              {slices.map((sl,i)=>(
                <div key={i} style={{ width:`${(sl.value/total)*100}%`, background:sl.color, transition:"width 0.4s" }}/>
              ))}
            </div>
          </div>

          {/* remaining indicator */}
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
            <span style={{ color:"rgba(255,255,255,0.45)" }}>وُزِّع: {fmt(sharesSum)} ج</span>
            <span style={{ fontWeight:700, color: remaining<0?"#FF6B6B":remaining===0?"#4ECDC4":"#FFE66D" }}>
              {remaining>=0?"متبقي ":"زيادة "}{fmt(Math.abs(remaining))} ج
            </span>
          </div>

          {/* per-group share bars */}
          <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:8 }}>
            {data.groups.map((g,i)=>{
              const share = parseFloat(g.budgetShare)||0;
              const pct = total>0?(share/total)*100:0;
              const color = COLORS[i%COLORS.length];
              return (
                <div key={g.id}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontSize:12 }}>{g.icon} {g.name}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{pct.toFixed(0)}%</span>
                      <div style={{ width:80 }}>
                        <NumInput value={g.budgetShare} onChange={v=>onShareChange(i,v)} placeholder="0" style={{ fontSize:12, padding:"3px 6px", borderColor: share>0?color:"rgba(255,255,255,0.12)" }} />
                      </div>
                      <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)", minWidth:8 }}>ج</span>
                    </div>
                  </div>
                  <div style={{ height:5, borderRadius:3, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                    <div style={{ width:`${Math.min(pct,100)}%`, height:"100%", background:color, borderRadius:3, transition:"width 0.3s" }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MoBudget() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData] = useState(() => {
    const s = loadStore();
    if (s && s.year===now.getFullYear() && s.month===now.getMonth()) return s;
    return makeMonthData(now.getFullYear(), now.getMonth());
  });
  const [tab, setTab] = useState("groups");
  const [toast, setToast] = useState(null);
  const importRef = useRef();

  useEffect(()=>{ saveStore(data); },[data]);

  function showToast(msg){ setToast(msg); setTimeout(()=>setToast(null),2400); }

  function setMode(m){ setData(d=>({...d,mode:m})); }

  function updateGroup(idx,updated){ setData(d=>({...d,groups:d.groups.map((g,i)=>i===idx?updated:g)})); }
  function deleteGroup(idx){ setData(d=>({...d,groups:d.groups.filter((_,i)=>i!==idx)})); showToast("🗑️ اتحذفت"); }
  function addGroup(){ setData(d=>({...d,groups:[...d.groups,{id:uid(),name:"مجموعة جديدة",icon:"📌",budgetShare:"",items:[makeItem()]}]})); }

  function prevMonth(){ const d=new Date(year,month-1,1); setYear(d.getFullYear()); setMonth(d.getMonth()); }
  function nextMonth(){ const d=new Date(year,month+1,1); setYear(d.getFullYear()); setMonth(d.getMonth()); }
  function loadMonth(){
    const s=loadStore();
    if(s&&s.year===year&&s.month===month){ setData(s); showToast("✅ اتحمل"); }
    else { setData(makeMonthData(year,month)); showToast("🆕 شهر جديد"); }
  }

  function exportData(){
    const name=`mo-budget-${MONTHS_AR[data.month]}-${data.year}.json`;
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=name; a.click();
    URL.revokeObjectURL(url);
    showToast(`📤 اتحمل ${name}`);
  }
  function importData(e){
    const file=e.target.files[0]; if(!file)return;
    const r=new FileReader();
    r.onload=ev=>{ try{ const p=JSON.parse(ev.target.result); if(!p.groups||!p.workDays)throw 0; setData(p); saveStore(p); showToast("📥 اتحملت ✅"); }catch{ showToast("❌ file غلط"); } };
    r.readAsText(file); e.target.value="";
  }

  return (
    <div style={{ minHeight:"100vh", direction:"rtl", background:"#0d0d14", fontFamily:"'Cairo','Segoe UI',sans-serif", color:"#fff" }}>
      <div style={{ position:"fixed", top:"10%", right:"-5%", width:280, height:280, borderRadius:"50%", background:"radial-gradient(circle,rgba(108,92,231,0.12),transparent 70%)", pointerEvents:"none" }}/>
      <div style={{ position:"fixed", bottom:"5%", left:"-5%", width:220, height:220, borderRadius:"50%", background:"radial-gradient(circle,rgba(78,205,196,0.08),transparent 70%)", pointerEvents:"none" }}/>

      <div style={{ maxWidth:500, margin:"0 auto", padding:"20px 14px 100px", position:"relative", zIndex:1 }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:18 }}>
          <div style={{ fontSize:11, letterSpacing:3, color:"rgba(255,255,255,0.3)", marginBottom:4 }}>BUDGET TRACKER</div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:800, background:"linear-gradient(90deg,#fff 60%,rgba(108,92,231,0.8))", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>ميزانية Mo</h1>
        </div>

        {/* Mode toggle */}
        <div style={{ display:"flex", background:"rgba(255,255,255,0.05)", borderRadius:14, padding:4, marginBottom:16, border:"1px solid rgba(255,255,255,0.08)" }}>
          {[["plan","📋 تخطيط البنود"],["budget","💰 توزيع الميزانية"]].map(([m,label])=>(
            <button key={m} onClick={()=>setMode(m)} style={{
              flex:1, padding:"9px 0", borderRadius:11, fontSize:12, cursor:"pointer", fontFamily:"inherit", fontWeight:600,
              background:data.mode===m?"rgba(108,92,231,0.35)":"transparent",
              border:data.mode===m?"1px solid rgba(108,92,231,0.5)":"1px solid transparent",
              color:data.mode===m?"#fff":"rgba(255,255,255,0.45)", transition:"all 0.2s",
            }}>{label}</button>
          ))}
        </div>

        {/* Month nav */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:16 }}>
          <button onClick={nextMonth} style={navBtn}>›</button>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:16, fontWeight:700 }}>{MONTHS_AR[month]} {year}</div>
            {(data.year!==year||data.month!==month)&&(
              <button onClick={loadMonth} style={{ background:"rgba(108,92,231,0.2)", border:"1px solid rgba(108,92,231,0.4)", borderRadius:8, color:"#a29bfe", fontSize:11, padding:"2px 10px", cursor:"pointer", marginTop:4, fontFamily:"inherit" }}>تحميل هذا الشهر</button>
            )}
          </div>
          <button onClick={prevMonth} style={navBtn}>‹</button>
        </div>

        <Summary data={data} />

        {/* Budget mode panel */}
        {data.mode==="budget" && (
          <BudgetModePanel data={data}
            onTotalChange={v=>setData(d=>({...d,totalBudget:v}))}
            onShareChange={(idx,v)=>{ const groups=data.groups.map((g,i)=>i===idx?{...g,budgetShare:v}:g); setData(d=>({...d,groups})); }}
          />
        )}

        {/* Export/Import */}
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <button onClick={exportData} style={{ flex:1, padding:"10px 0", borderRadius:12, fontSize:13, cursor:"pointer", background:"rgba(78,205,196,0.1)", border:"1px solid rgba(78,205,196,0.25)", color:"rgba(78,205,196,0.9)", fontFamily:"inherit", fontWeight:600 }}>📤 تصدير</button>
          <button onClick={()=>importRef.current.click()} style={{ flex:1, padding:"10px 0", borderRadius:12, fontSize:13, cursor:"pointer", background:"rgba(162,155,254,0.1)", border:"1px solid rgba(162,155,254,0.25)", color:"rgba(162,155,254,0.9)", fontFamily:"inherit", fontWeight:600 }}>📥 استيراد</button>
          <input ref={importRef} type="file" accept=".json" onChange={importData} style={{ display:"none" }}/>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          {[["groups","📋 المجموعات"],["days","🗓️ الأيام"]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{
              flex:1, padding:"9px 0", borderRadius:12, fontSize:12, cursor:"pointer", fontFamily:"inherit",
              background:tab===k?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.04)",
              border:tab===k?"1px solid rgba(255,255,255,0.2)":"1px solid rgba(255,255,255,0.07)",
              color:tab===k?"#fff":"rgba(255,255,255,0.45)", fontWeight:tab===k?700:400,
            }}>{l}</button>
          ))}
          <button onClick={()=>{ setData(makeMonthData(year,month)); showToast("✅ شهر جديد"); }} style={{
            padding:"9px 14px", borderRadius:12, fontSize:11, cursor:"pointer", fontFamily:"inherit",
            background:"rgba(255,230,109,0.08)", border:"1px solid rgba(255,230,109,0.2)", color:"rgba(255,230,109,0.7)",
          }}>🔄 جديد</button>
        </div>

        {tab==="groups" && (
          <>
            {data.groups.map((g,idx)=>(
              <GroupCard key={g.id} group={g} mode={data.mode}
                budgetShare={g.budgetShare}
                onBudgetShareChange={v=>{ const groups=data.groups.map((gg,i)=>i===idx?{...gg,budgetShare:v}:gg); setData(d=>({...d,groups})); }}
                onChange={updated=>updateGroup(idx,updated)}
                onDelete={()=>deleteGroup(idx)} />
            ))}
            <button onClick={addGroup} style={{ width:"100%", padding:12, borderRadius:12, marginTop:4, background:"rgba(108,92,231,0.1)", border:"1px dashed rgba(108,92,231,0.3)", color:"rgba(162,155,254,0.8)", cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>+ إضافة مجموعة</button>
          </>
        )}
        {tab==="days" && (
          <WorkDaysCard workDays={data.workDays} onChange={wd=>setData(d=>({...d,workDays:wd}))} />
        )}
      </div>

      {toast && (
        <div style={{ position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)", background:"rgba(20,20,35,0.97)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:12, padding:"10px 22px", fontSize:13, color:"#fff", boxShadow:"0 8px 32px rgba(0,0,0,0.5)", zIndex:200, whiteSpace:"nowrap" }}>{toast}</div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        * { box-sizing:border-box; }
        input:focus { outline:1px solid rgba(108,92,231,0.4); }
        input[type=number]::-webkit-inner-spin-button { opacity:0.3; }
      `}</style>
    </div>
  );
}

const navBtn = { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#fff", cursor:"pointer", fontSize:20, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center" };
