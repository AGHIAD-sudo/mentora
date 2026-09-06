(() => {
  "use strict";

  const SESSIONS_KEY = "darsi_tutoring_sessions_v1";
  const STUDENTS_KEY = "darsi_tutoring_students_v2";
  const BACKUP_VERSION = 2;

  const DEFAULT_STUDENTS = [
    { id: "badr", name: "بدر", address: "", rate: 50000, pricingType: "hourly", active: true },
    { id: "malaz", name: "ملاذ", address: "", rate: 50000, pricingType: "hourly", active: true },
    { id: "hassan", name: "حسن", address: "", rate: 35000, pricingType: "hourly", active: true },
    { id: "elaf", name: "إيلاف", address: "", rate: 35000, pricingType: "hourly", active: true }
  ];

  const SUBJECTS = Object.freeze({
    math: { name: "رياضيات", icon: "📐" },
    physics: { name: "فيزياء", icon: "⚛️" },
    chemistry: { name: "كيمياء", icon: "🧪" }
  });

  const STATUS_LABELS = Object.freeze({ paid: "تم الدفع", partial: "دفعة جزئية", unpaid: "غير مدفوع" });

  const state = {
    sessions: loadSessions(),
    students: loadStudents(),
    selectedHours: null,
    paymentStatus: "unpaid",
    activeDialogSessionId: null,
    activeStudentId: null,
    deferredInstallPrompt: null
  };

  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const els = {
    todayLabel: $("todayLabel"), viewTitle: $("viewTitle"), debtBadge: $("debtBadge"),
    dashboardPeriod: $("dashboardPeriod"), totalExpected: $("totalExpected"), totalPaid: $("totalPaid"),
    totalDebt: $("totalDebt"), totalHours: $("totalHours"), expectedHint: $("expectedHint"),
    paidHint: $("paidHint"), debtHint: $("debtHint"), hoursHint: $("hoursHint"),
    studentSummary: $("studentSummary"), recentActivity: $("recentActivity"), subjectBreakdown: $("subjectBreakdown"), dailySummary: $("dailySummary"),

    sessionForm: $("sessionForm"), studentSelect: $("studentSelect"), subjectSelect: $("subjectSelect"),
    sessionDate: $("sessionDate"), customHours: $("customHours"), rateHint: $("rateHint"),
    partialPaymentField: $("partialPaymentField"), partialPayment: $("partialPayment"), partialHint: $("partialHint"),
    sessionNote: $("sessionNote"), amountPreview: $("amountPreview"), amountFormula: $("amountFormula"),
    saveSessionBtn: $("saveSessionBtn"), previewAvatar: $("previewAvatar"), previewStudent: $("previewStudent"),
    previewSubject: $("previewSubject"), previewDate: $("previewDate"), previewHours: $("previewHours"),
    previewRate: $("previewRate"), previewRateLabel: $("previewRateLabel"), previewStatus: $("previewStatus"), previewTotal: $("previewTotal"),

    debtForm: $("debtForm"), debtSessionSelect: $("debtSessionSelect"), debtSelectedDetails: $("debtSelectedDetails"),
    debtPaymentAmount: $("debtPaymentAmount"), debtPaymentDate: $("debtPaymentDate"), saveDebtBtn: $("saveDebtBtn"),
    openDebtsList: $("openDebtsList"), debtsTotalHeader: $("debtsTotalHeader"),

    studentManagementList: $("studentManagementList"), studentsEmpty: $("studentsEmpty"),
    addStudentBtn: $("addStudentBtn"), studentSearch: $("studentSearch"), studentStateFilter: $("studentStateFilter"),
    studentDialog: $("studentDialog"), studentForm: $("studentForm"), studentDialogTitle: $("studentDialogTitle"),
    studentIdField: $("studentIdField"), studentNameField: $("studentNameField"), studentAddressField: $("studentAddressField"),
    studentPricingType: $("studentPricingType"), studentRateLabel: $("studentRateLabel"), studentRateField: $("studentRateField"),
    archiveStudentBtn: $("archiveStudentBtn"), deleteStudentBtn: $("deleteStudentBtn"), saveStudentBtn: $("saveStudentBtn"),

    recordsStudentFilter: $("recordsStudentFilter"), recordsSubjectFilter: $("recordsSubjectFilter"),
    recordsStatusFilter: $("recordsStatusFilter"), recordsMonthFilter: $("recordsMonthFilter"),
    clearFiltersBtn: $("clearFiltersBtn"), recordsTableBody: $("recordsTableBody"), recordsMobileList: $("recordsMobileList"), recordsEmpty: $("recordsEmpty"),

    exportBtn: $("exportBtn"), importInput: $("importInput"), exportCsvBtn: $("exportCsvBtn"), installAppBtn: $("installAppBtn"), mobileFab: $("mobileFab"),
    toast: $("toast"), toastText: $("toastText"), sessionDialog: $("sessionDialog"),
    dialogTitle: $("dialogTitle"), dialogContent: $("dialogContent"), deleteSessionBtn: $("deleteSessionBtn")
  };

  function init() {
    ensureStudentsForLegacySessions();
    populateStudentControls();
    setDefaultDates();
    bindEvents();
    registerPwa();
    renderAll();
    updateSessionPreview();
    renderTodayLabel();
  }

  function loadSessions() {
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(normalizeSession).filter(Boolean) : [];
    } catch (error) {
      console.warn("Could not load sessions:", error);
      return [];
    }
  }

  function loadStudents() {
    try {
      const raw = localStorage.getItem(STUDENTS_KEY);
      if (!raw) return DEFAULT_STUDENTS.map(s => normalizeStudent({ ...s, createdAt: new Date().toISOString() }));
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_STUDENTS.map(s => normalizeStudent(s));
      return parsed.map(normalizeStudent).filter(Boolean);
    } catch (error) {
      console.warn("Could not load students:", error);
      return DEFAULT_STUDENTS.map(s => normalizeStudent(s));
    }
  }

  function normalizeStudent(s) {
    if (!s || !s.id || !String(s.name || "").trim()) return null;
    return {
      id: String(s.id),
      name: String(s.name).trim(),
      address: String(s.address || "").trim(),
      rate: Math.max(0, safeNumber(s.rate)),
      pricingType: s.pricingType === "session" ? "session" : "hourly",
      active: s.active !== false,
      createdAt: s.createdAt || new Date().toISOString(),
      updatedAt: s.updatedAt || s.createdAt || new Date().toISOString()
    };
  }

  function normalizeSession(s) {
    if (!s || !s.id || !s.studentId || !s.date || !s.subject) return null;
    const total = safeNumber(s.total);
    const paid = Math.min(total, Math.max(0, safeNumber(s.paid)));
    const pricingType = s.pricingType === "session" ? "session" : "hourly";
    const unitRate = safeNumber(s.unitRate ?? s.hourlyRate);
    return {
      id: String(s.id), studentId: String(s.studentId), subject: String(s.subject), date: String(s.date),
      hours: safeNumber(s.hours), pricingType, unitRate, hourlyRate: safeNumber(s.hourlyRate ?? unitRate), total, paid,
      note: typeof s.note === "string" ? s.note : "", createdAt: s.createdAt || new Date().toISOString(),
      payments: Array.isArray(s.payments) ? s.payments.map(p => ({ id: String(p.id || uid()), amount: safeNumber(p.amount), date: String(p.date || s.date) })) : []
    };
  }

  function ensureStudentsForLegacySessions() {
    const known = new Set(state.students.map(s => s.id));
    const defaults = new Map(DEFAULT_STUDENTS.map(s => [s.id, s]));
    let changed = false;
    state.sessions.forEach(session => {
      if (known.has(session.studentId)) return;
      const fallback = defaults.get(session.studentId);
      const created = normalizeStudent(fallback || { id: session.studentId, name: `طالب ${session.studentId}`, rate: session.unitRate || session.hourlyRate || 0, active: false });
      if (created) {
        state.students.push(created);
        known.add(created.id);
        changed = true;
      }
    });
    if (changed) persistStudents();
  }

  function persistSessions() {
    try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(state.sessions)); return true; }
    catch (error) { console.warn("Sessions storage unavailable:", error); return false; }
  }

  function persistStudents() {
    try { localStorage.setItem(STUDENTS_KEY, JSON.stringify(state.students)); return true; }
    catch (error) { console.warn("Students storage unavailable:", error); return false; }
  }

  function persistAll() { return persistSessions() && persistStudents(); }

  function bindEvents() {
    $$(".nav-item").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
    $$('[data-jump]').forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.jump)));
    els.mobileFab?.addEventListener("click", () => switchView("entry"));

    els.dashboardPeriod.addEventListener("change", renderDashboard);
    els.studentSelect.addEventListener("change", () => { updateRateHint(); updateSessionPreview(); });
    els.subjectSelect.addEventListener("change", updateSessionPreview);
    els.sessionDate.addEventListener("change", updateSessionPreview);
    els.partialPayment.addEventListener("input", updateSessionPreview);
    $$("#hourChips button").forEach(btn => btn.addEventListener("click", () => selectHours(btn.dataset.hours, btn)));
    $$("#paymentStatusChoice button").forEach(btn => btn.addEventListener("click", () => selectPaymentStatus(btn.dataset.status, btn)));
    els.customHours.addEventListener("input", () => { state.selectedHours = safeNumber(els.customHours.value); updateSessionPreview(); });
    els.sessionForm.addEventListener("submit", saveSession);

    els.debtSessionSelect.addEventListener("change", renderSelectedDebt);
    els.debtForm.addEventListener("submit", settleDebt);
    els.openDebtsList.addEventListener("click", event => {
      const btn = event.target.closest("[data-settle-id]");
      if (!btn) return;
      els.debtSessionSelect.value = btn.dataset.settleId;
      renderSelectedDebt();
      els.debtPaymentAmount.focus();
      scrollElementIntoView(els.debtForm);
    });
    els.debtSelectedDetails.addEventListener("click", event => {
      const fill = event.target.closest("[data-fill-remaining]");
      if (!fill) return;
      els.debtPaymentAmount.value = fill.dataset.fillRemaining;
      els.debtPaymentAmount.focus();
    });

    [els.recordsStudentFilter, els.recordsSubjectFilter, els.recordsStatusFilter, els.recordsMonthFilter]
      .forEach(el => el.addEventListener("change", renderRecords));
    els.clearFiltersBtn.addEventListener("click", clearRecordFilters);
    [els.recordsTableBody, els.recordsMobileList].forEach(root => root?.addEventListener("click", event => {
      const btn = event.target.closest("[data-session-id]");
      if (btn) openSessionDialog(btn.dataset.sessionId);
    }));

    els.addStudentBtn.addEventListener("click", () => openStudentDialog());
    els.studentSearch.addEventListener("input", renderStudentManagement);
    els.studentStateFilter.addEventListener("change", renderStudentManagement);
    els.studentManagementList.addEventListener("click", event => {
      const edit = event.target.closest("[data-edit-student]");
      const quick = event.target.closest("[data-new-session-student]");
      if (edit) openStudentDialog(edit.dataset.editStudent);
      if (quick) startSessionForStudent(quick.dataset.newSessionStudent);
    });
    els.studentPricingType.addEventListener("change", updateStudentRateLabel);
    els.studentForm.addEventListener("submit", saveStudent);
    $("closeStudentDialogBtn").addEventListener("click", closeStudentDialog);
    $("cancelStudentBtn").addEventListener("click", closeStudentDialog);
    els.archiveStudentBtn.addEventListener("click", toggleArchiveStudent);
    els.deleteStudentBtn.addEventListener("click", deleteStudentPermanently);

    els.exportBtn.addEventListener("click", exportBackup);
    els.importInput.addEventListener("change", importBackup);
    els.exportCsvBtn.addEventListener("click", exportCsv);
    els.installAppBtn?.addEventListener("click", installPwa);

    $("closeDialogBtn").addEventListener("click", () => els.sessionDialog.close());
    $("closeDialogBtn2").addEventListener("click", () => els.sessionDialog.close());
    els.deleteSessionBtn.addEventListener("click", deleteActiveSession);

    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      state.deferredInstallPrompt = event;
      els.installAppBtn?.classList.remove("hidden-field");
    });
    window.addEventListener("appinstalled", () => {
      state.deferredInstallPrompt = null;
      els.installAppBtn?.classList.add("hidden-field");
      showToast("تم تثبيت التطبيق على الهاتف");
    });
  }

  function renderTodayLabel() {
    const today = new Intl.DateTimeFormat("ar-SY", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date());
    els.todayLabel.textContent = today;
  }

  function populateStudentControls() {
    const active = state.students.filter(s => s.active).sort(sortStudents);
    const all = [...state.students].sort(sortStudents);
    const selectedSessionStudent = els.studentSelect.value;
    const selectedRecordStudent = els.recordsStudentFilter.value || "all";

    els.studentSelect.innerHTML = `<option value="">اختر الطالب</option>` + active.map(studentOption).join("");
    if (active.some(s => s.id === selectedSessionStudent)) els.studentSelect.value = selectedSessionStudent;

    els.recordsStudentFilter.innerHTML = `<option value="all">كل الطلاب</option>` + all.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}${s.active ? "" : " — مؤرشف"}</option>`).join("");
    if (selectedRecordStudent === "all" || all.some(s => s.id === selectedRecordStudent)) els.recordsStudentFilter.value = selectedRecordStudent;
  }

  function studentOption(s) {
    const price = `${formatMoney(s.rate)}${s.pricingType === "hourly" ? "/ساعة" : "/جلسة"}`;
    return `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} — ${price}</option>`;
  }

  function setDefaultDates() {
    const today = toDateInputValue(new Date());
    els.sessionDate.value = today;
    els.debtPaymentDate.value = today;
  }

  function switchView(view) {
    const titleMap = { dashboard: "لوحة التحكم", entry: "إضافة جلسة", debts: "تسديد الديون", students: "إدارة الطلاب", records: "سجل الجلسات" };
    $$(".view").forEach(v => v.classList.remove("active"));
    $$(".nav-item").forEach(v => v.classList.toggle("active", v.dataset.view === view));
    const target = $(`${view}View`);
    if (target) target.classList.add("active");
    els.viewTitle.textContent = titleMap[view] || "درسّي";
    if (view === "debts") { renderDebtControls(); renderSelectedDebt(); renderDebtsList(); }
    if (view === "records") renderRecords();
    if (view === "students") renderStudentManagement();
    els.mobileFab?.classList.toggle("fab-hidden", view === "entry");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectHours(value, button) {
    $$("#hourChips button").forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
    if (value === "custom") {
      els.customHours.classList.remove("hidden-field");
      els.customHours.focus();
      state.selectedHours = safeNumber(els.customHours.value);
    } else {
      els.customHours.classList.add("hidden-field");
      els.customHours.value = "";
      state.selectedHours = safeNumber(value);
    }
    updateSessionPreview();
  }

  function selectPaymentStatus(status, button) {
    state.paymentStatus = status;
    $$("#paymentStatusChoice button").forEach(btn => btn.classList.toggle("active", btn === button));
    els.partialPaymentField.classList.toggle("hidden-field", status !== "partial");
    if (status !== "partial") els.partialPayment.value = "";
    updateSessionPreview();
  }

  function getSelectedStudent() { return getStudent(els.studentSelect.value); }

  function calculateSessionTotal(student, hours) {
    if (!student || hours <= 0) return 0;
    return student.pricingType === "session" ? student.rate : student.rate * hours;
  }

  function updateRateHint() {
    const student = getSelectedStudent();
    if (!student) {
      els.rateHint.textContent = "السعر يظهر بعد اختيار الطالب";
      return;
    }
    els.rateHint.textContent = student.pricingType === "hourly"
      ? `سعر الساعة: ${formatMoney(student.rate)}`
      : `سعر الجلسة الثابت: ${formatMoney(student.rate)} مهما كان عدد الساعات`;
  }

  function updateSessionPreview() {
    const student = getSelectedStudent();
    const subject = SUBJECTS[els.subjectSelect.value];
    const hours = safeNumber(state.selectedHours);
    const total = calculateSessionTotal(student, hours);

    els.amountPreview.textContent = formatMoney(total);
    els.previewTotal.textContent = formatMoney(total);
    els.previewStudent.textContent = student?.name || "لم يتم اختيار طالب";
    els.previewAvatar.textContent = student?.name?.charAt(0) || "؟";
    els.previewSubject.textContent = subject ? `${subject.icon} ${subject.name}` : "—";
    els.previewDate.textContent = els.sessionDate.value ? formatDate(els.sessionDate.value) : "—";
    els.previewHours.textContent = hours > 0 ? `${formatHours(hours)} ساعة` : "—";
    els.previewRate.textContent = student ? formatMoney(student.rate) : "—";
    els.previewRateLabel.textContent = student?.pricingType === "session" ? "سعر الجلسة" : "سعر الساعة";
    els.previewStatus.innerHTML = statusPill(state.paymentStatus);

    if (student && hours > 0) {
      els.amountFormula.textContent = student.pricingType === "hourly"
        ? `${formatHours(hours)} ساعة × ${formatMoney(student.rate)} = ${formatMoney(total)}`
        : `سعر ثابت للجلسة = ${formatMoney(total)} · مدة الجلسة ${formatHours(hours)} ساعة`;
    } else {
      els.amountFormula.textContent = "اختر الطالب وعدد الساعات ليتم الحساب تلقائياً.";
    }

    if (state.paymentStatus === "partial") {
      const paid = safeNumber(els.partialPayment.value);
      const remaining = Math.max(0, total - paid);
      els.partialHint.textContent = total > 0 ? `المتبقي بعد هذه الدفعة: ${formatMoney(remaining)}` : "سيظهر المتبقي بعد تحديد الطالب والساعات.";
    }
  }

  function saveSession(event) {
    event.preventDefault();
    const student = getSelectedStudent();
    const subject = els.subjectSelect.value;
    const hours = safeNumber(state.selectedHours);
    const date = els.sessionDate.value;

    if (!student || !student.active) return showToast("اختر طالباً حالياً أولاً", "error");
    if (!SUBJECTS[subject]) return showToast("اختر المادة الدراسية", "error");
    if (!date) return showToast("اختر تاريخ الجلسة", "error");
    if (!hours || hours <= 0 || hours > 12) return showToast("أدخل عدد ساعات صحيحاً", "error");

    const total = calculateSessionTotal(student, hours);
    if (total <= 0) return showToast("سعر الطالب غير صالح. عدّل بيانات الطالب أولاً", "error");
    let paid = 0;
    if (state.paymentStatus === "paid") paid = total;
    if (state.paymentStatus === "partial") {
      paid = safeNumber(els.partialPayment.value);
      if (paid <= 0) return showToast("أدخل قيمة الدفعة الجزئية", "error");
      if (paid >= total) return showToast("للإجمالي الكامل اختر: تم الدفع بالكامل", "error");
    }

    setButtonLoading(els.saveSessionBtn, true);
    const session = {
      id: uid(), studentId: student.id, subject, date, hours,
      pricingType: student.pricingType, unitRate: student.rate, hourlyRate: student.pricingType === "hourly" ? student.rate : 0,
      total, paid, note: els.sessionNote.value.trim(), createdAt: new Date().toISOString(),
      payments: paid > 0 ? [{ id: uid(), amount: paid, date }] : []
    };

    state.sessions.push(session);
    persistSessions();
    renderAll();

    window.setTimeout(() => {
      setButtonLoading(els.saveSessionBtn, false);
      showToast(`تم حفظ جلسة ${student.name} بنجاح`);
      resetSessionForm();
    }, 180);
  }

  function resetSessionForm() {
    els.sessionForm.reset();
    els.sessionDate.value = toDateInputValue(new Date());
    state.selectedHours = null;
    state.paymentStatus = "unpaid";
    $$("#hourChips button").forEach(btn => btn.classList.remove("active"));
    $$("#paymentStatusChoice button").forEach(btn => btn.classList.toggle("active", btn.dataset.status === "unpaid"));
    els.customHours.classList.add("hidden-field");
    els.partialPaymentField.classList.add("hidden-field");
    updateRateHint();
    updateSessionPreview();
  }

  function renderAll() {
    populateStudentControls();
    renderDashboard();
    renderDebtControls();
    renderDebtsList();
    renderRecords();
    renderStudentManagement();
    const openCount = getOpenDebts().length;
    els.debtBadge.textContent = toArabicDigits(openCount);
    els.debtBadge.style.display = openCount ? "grid" : "none";
  }

  function renderDashboard() {
    const sessions = filterByPeriod(state.sessions, els.dashboardPeriod.value);
    const expected = sum(sessions, s => s.total);
    const paid = sum(sessions, s => s.paid);
    const debt = Math.max(0, expected - paid);
    const hours = sum(sessions, s => s.hours);
    const openDebtCount = sessions.filter(s => getRemaining(s) > 0).length;
    const rate = expected ? Math.round((paid / expected) * 100) : 0;
    const avgHours = sessions.length ? hours / sessions.length : 0;

    els.totalExpected.textContent = formatMoney(expected);
    els.totalPaid.textContent = formatMoney(paid);
    els.totalDebt.textContent = formatMoney(debt);
    els.totalHours.textContent = `${formatHours(hours)} ساعة`;
    els.expectedHint.textContent = `${toArabicDigits(sessions.length)} جلسة`;
    els.paidHint.textContent = `نسبة التحصيل ${toArabicDigits(rate)}٪`;
    els.debtHint.textContent = `${toArabicDigits(openDebtCount)} جلسة عليها متبقي`;
    els.hoursHint.textContent = `متوسط ${formatHours(avgHours)} ساعة/جلسة`;

    renderStudentSummary(sessions);
    renderRecentActivity(sessions);
    renderSubjectBreakdown(sessions);
    renderDailySummary(sessions);
  }

  function renderStudentSummary(sessions) {
    const visibleStudents = state.students.filter(student => student.active || sessions.some(s => s.studentId === student.id)).sort(sortStudents);
    if (!visibleStudents.length) {
      els.studentSummary.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div>👥</div><h4>لا يوجد طلاب بعد</h4><p>أضف أول طالب من تبويب الطلاب.</p></div>`;
      return;
    }
    els.studentSummary.innerHTML = visibleStudents.map(student => {
      const rows = sessions.filter(s => s.studentId === student.id);
      const hours = sum(rows, s => s.hours);
      const expected = sum(rows, s => s.total);
      const debt = sum(rows, s => getRemaining(s));
      return `
        <article class="student-card ${student.active ? "" : "archived"}">
          <div class="student-card-head">
            <div class="student-ident"><div class="student-avatar">${escapeHtml(student.name.charAt(0))}</div><div><strong>${escapeHtml(student.name)}</strong><small>${pricingText(student)}</small></div></div>
            <span class="debt-chip ${debt === 0 ? "clear" : ""}">${debt === 0 ? "لا ديون" : formatMoney(debt)}</span>
          </div>
          <div class="student-metrics">
            <div><strong>${toArabicDigits(rows.length)}</strong><span>جلسة</span></div>
            <div><strong>${formatHours(hours)}</strong><span>ساعة</span></div>
            <div><strong>${compactMoney(expected)}</strong><span>متوقع</span></div>
          </div>
        </article>`;
    }).join("");
  }

  function renderRecentActivity(sessions) {
    const latest = [...sessions].sort(sortSessionsNewest).slice(0, 5);
    if (!latest.length) {
      els.recentActivity.innerHTML = `<div class="empty-state"><div>📝</div><h4>لا توجد جلسات بعد</h4><p>أضف أول جلسة لتظهر هنا.</p></div>`;
      return;
    }
    els.recentActivity.innerHTML = latest.map(s => {
      const student = getStudent(s.studentId);
      const subject = SUBJECTS[s.subject];
      return `<div class="activity-item"><div class="activity-icon">${subject?.icon || "•"}</div><div><strong>${escapeHtml(student?.name || "طالب")}</strong><small>${subject?.name || "—"} · ${formatDate(s.date)} · ${formatHours(s.hours)} ساعة</small></div><div class="activity-amount"><strong>${formatMoney(s.total)}</strong>${statusPill(getStatus(s))}</div></div>`;
    }).join("");
  }

  function renderSubjectBreakdown(sessions) {
    const totalHours = sum(sessions, s => s.hours);
    els.subjectBreakdown.innerHTML = Object.entries(SUBJECTS).map(([key, subject]) => {
      const hours = sum(sessions.filter(s => s.subject === key), s => s.hours);
      const pct = totalHours ? Math.round(hours / totalHours * 100) : 0;
      return `<div class="breakdown-row ${key}"><div class="breakdown-meta"><span>${subject.icon} ${subject.name}</span><span>${formatHours(hours)} ساعة · ${toArabicDigits(pct)}٪</span></div><div class="progress"><span style="width:${pct}%"></span></div></div>`;
    }).join("");
  }

  function renderDailySummary(sessions) {
    const groups = new Map();
    [...sessions].sort((a,b) => b.date.localeCompare(a.date)).forEach(session => {
      if (!groups.has(session.date)) groups.set(session.date, []);
      groups.get(session.date).push(session);
    });
    const entries = [...groups.entries()].slice(0, 12);
    if (!entries.length) {
      els.dailySummary.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div>📅</div><h4>لا توجد بيانات زمنية بعد</h4><p>ستظهر الأيام والجلسات هنا تلقائياً.</p></div>`;
      return;
    }
    els.dailySummary.innerHTML = entries.map(([date, rows]) => {
      const hours = sum(rows, s => s.hours);
      const expected = sum(rows, s => s.total);
      const debt = sum(rows, s => getRemaining(s));
      return `<article class="daily-card"><div class="day-head"><strong>${formatDate(date)}</strong><span>${toArabicDigits(rows.length)} جلسة</span></div><div class="day-metrics"><div><b>${formatHours(hours)}</b><small>ساعة</small></div><div><b>${compactMoney(expected)}</b><small>متوقع</small></div><div><b>${compactMoney(debt)}</b><small>متبقي</small></div></div></article>`;
    }).join("");
  }

  function getOpenDebts() { return state.sessions.filter(s => getRemaining(s) > 0).sort((a,b) => a.date.localeCompare(b.date)); }

  function renderDebtControls() {
    const open = getOpenDebts();
    const current = els.debtSessionSelect.value;
    els.debtSessionSelect.innerHTML = `<option value="">اختر جلسة غير مسددة</option>` + open.map(s => {
      const student = getStudent(s.studentId);
      const subject = SUBJECTS[s.subject];
      return `<option value="${escapeHtml(s.id)}">${escapeHtml(student?.name || "طالب")} — ${formatDate(s.date)} — ${subject?.name || ""} — متبقي ${formatMoney(getRemaining(s))}</option>`;
    }).join("");
    if (open.some(s => s.id === current)) els.debtSessionSelect.value = current;
  }

  function renderSelectedDebt() {
    const session = state.sessions.find(s => s.id === els.debtSessionSelect.value);
    if (!session || getRemaining(session) <= 0) {
      els.debtSelectedDetails.className = "debt-selected empty";
      els.debtSelectedDetails.innerHTML = "<p>اختر جلسة لرؤية تفاصيل المبلغ المتبقي.</p>";
      els.debtPaymentAmount.value = "";
      els.debtPaymentAmount.removeAttribute("max");
      return;
    }
    const student = getStudent(session.studentId);
    const remaining = getRemaining(session);
    els.debtSelectedDetails.className = "debt-selected";
    els.debtSelectedDetails.innerHTML = `
      <div class="debt-detail-grid">
        <div><span>الطالب</span><strong>${escapeHtml(student?.name || "طالب")}</strong></div>
        <div><span>الإجمالي</span><strong>${formatMoney(session.total)}</strong></div>
        <div class="remaining"><span>المتبقي</span><strong>${formatMoney(remaining)}</strong></div>
      </div>
      <button class="quick-full-payment" type="button" data-fill-remaining="${remaining}">تعبئة كامل المتبقي ${formatMoney(remaining)}</button>`;
    els.debtPaymentAmount.setAttribute("max", String(remaining));
  }

  function settleDebt(event) {
    event.preventDefault();
    const session = state.sessions.find(s => s.id === els.debtSessionSelect.value);
    if (!session) return showToast("اختر جلسة لتسجيل الدفعة", "error");
    const amount = safeNumber(els.debtPaymentAmount.value);
    const date = els.debtPaymentDate.value;
    const remaining = getRemaining(session);
    if (!date) return showToast("اختر تاريخ الدفعة", "error");
    if (amount <= 0) return showToast("أدخل مبلغاً صحيحاً", "error");
    if (amount > remaining) return showToast(`المبلغ أكبر من المتبقي ${formatMoney(remaining)}`, "error");

    setButtonLoading(els.saveDebtBtn, true);
    session.paid = Math.min(session.total, session.paid + amount);
    session.payments = Array.isArray(session.payments) ? session.payments : [];
    session.payments.push({ id: uid(), amount, date });
    persistSessions();
    renderAll();
    els.debtSessionSelect.value = getRemaining(session) > 0 ? session.id : "";
    renderSelectedDebt();
    els.debtPaymentAmount.value = "";
    window.setTimeout(() => {
      setButtonLoading(els.saveDebtBtn, false);
      showToast(getRemaining(session) === 0 ? "تم تسديد الجلسة بالكامل" : "تم تسجيل الدفعة وتحديث المتبقي");
    }, 160);
  }

  function renderDebtsList() {
    const open = getOpenDebts();
    const total = sum(open, s => getRemaining(s));
    els.debtsTotalHeader.textContent = formatMoney(total);
    if (!open.length) {
      els.openDebtsList.innerHTML = `<div class="empty-state"><div>🎉</div><h4>لا توجد ديون حالياً</h4><p>كل الجلسات مسددة بالكامل.</p></div>`;
      return;
    }
    els.openDebtsList.innerHTML = open.map(s => {
      const student = getStudent(s.studentId);
      const subject = SUBJECTS[s.subject];
      return `<button type="button" class="debt-item" data-settle-id="${escapeHtml(s.id)}"><div class="student-avatar">${escapeHtml(student?.name?.charAt(0) || "؟")}</div><div><strong>${escapeHtml(student?.name || "طالب")}</strong><small>${subject?.icon || ""} ${subject?.name || ""} · ${formatDate(s.date)} · ${formatHours(s.hours)} ساعة</small></div><div class="debt-value"><b>${formatMoney(getRemaining(s))}</b><span>متبقي</span></div></button>`;
    }).join("");
  }

  function renderRecords() {
    const student = els.recordsStudentFilter.value;
    const subject = els.recordsSubjectFilter.value;
    const status = els.recordsStatusFilter.value;
    const month = els.recordsMonthFilter.value;

    const rows = [...state.sessions].filter(s => {
      if (student !== "all" && s.studentId !== student) return false;
      if (subject !== "all" && s.subject !== subject) return false;
      if (status !== "all" && getStatus(s) !== status) return false;
      if (month && !s.date.startsWith(month)) return false;
      return true;
    }).sort(sortSessionsNewest);

    els.recordsTableBody.innerHTML = rows.map(s => {
      const st = getStudent(s.studentId); const sub = SUBJECTS[s.subject];
      return `<tr><td>${formatDate(s.date)}</td><td><strong>${escapeHtml(st?.name || "—")}</strong></td><td>${sub?.icon || ""} ${sub?.name || "—"}</td><td>${formatHours(s.hours)}</td><td>${formatMoney(s.total)}</td><td>${formatMoney(s.paid)}</td><td>${formatMoney(getRemaining(s))}</td><td>${statusPill(getStatus(s))}</td><td><button class="row-action" data-session-id="${escapeHtml(s.id)}" title="التفاصيل">⋯</button></td></tr>`;
    }).join("");

    els.recordsMobileList.innerHTML = rows.map(s => {
      const st = getStudent(s.studentId); const sub = SUBJECTS[s.subject];
      return `<button class="record-mobile-card" type="button" data-session-id="${escapeHtml(s.id)}">
        <div class="record-card-top"><div><strong>${escapeHtml(st?.name || "طالب")}</strong><span>${sub?.icon || ""} ${sub?.name || "—"}</span></div>${statusPill(getStatus(s))}</div>
        <div class="record-card-meta"><span>📅 ${formatDate(s.date)}</span><span>◷ ${formatHours(s.hours)} ساعة</span></div>
        <div class="record-card-money"><div><small>الإجمالي</small><b>${formatMoney(s.total)}</b></div><div><small>المدفوع</small><b>${formatMoney(s.paid)}</b></div><div><small>المتبقي</small><b class="${getRemaining(s) ? "danger-text" : "success-text"}">${formatMoney(getRemaining(s))}</b></div></div>
      </button>`;
    }).join("");

    els.recordsEmpty.classList.toggle("hidden-field", rows.length > 0);
  }

  function clearRecordFilters() {
    els.recordsStudentFilter.value = "all";
    els.recordsSubjectFilter.value = "all";
    els.recordsStatusFilter.value = "all";
    els.recordsMonthFilter.value = "";
    renderRecords();
  }

  function openSessionDialog(id) {
    const s = state.sessions.find(x => x.id === id);
    if (!s) return;
    state.activeDialogSessionId = id;
    const student = getStudent(s.studentId); const subject = SUBJECTS[s.subject]; const status = getStatus(s);
    const rateLabel = s.pricingType === "session" ? "سعر الجلسة" : "سعر الساعة";
    const rateValue = s.unitRate || s.hourlyRate;
    els.dialogTitle.textContent = `${student?.name || "طالب"} — ${subject?.name || "جلسة"}`;
    const history = (s.payments || []).slice().sort((a,b) => b.date.localeCompare(a.date));
    els.dialogContent.innerHTML = `
      <div class="dialog-grid">
        <div><span>التاريخ</span><strong>${formatDate(s.date)}</strong></div>
        <div><span>المادة</span><strong>${subject?.icon || ""} ${subject?.name || "—"}</strong></div>
        <div><span>عدد الساعات</span><strong>${formatHours(s.hours)} ساعة</strong></div>
        <div><span>${rateLabel}</span><strong>${formatMoney(rateValue)}</strong></div>
        <div><span>الإجمالي</span><strong>${formatMoney(s.total)}</strong></div>
        <div><span>الحالة</span><strong>${statusPill(status)}</strong></div>
        <div><span>المدفوع</span><strong>${formatMoney(s.paid)}</strong></div>
        <div><span>المتبقي</span><strong>${formatMoney(getRemaining(s))}</strong></div>
      </div>
      ${student?.address ? `<div class="dialog-note"><b>عنوان الطالب:</b> ${escapeHtml(student.address)}</div>` : ""}
      ${s.note ? `<div class="dialog-note"><b>ملاحظة:</b> ${escapeHtml(s.note)}</div>` : ""}
      <div class="payment-history"><h4>سجل الدفعات</h4>${history.length ? history.map(p => `<div class="payment-history-item"><span>${formatDate(p.date)}</span><strong>${formatMoney(p.amount)}</strong></div>`).join("") : `<small class="muted">لا توجد دفعات مسجلة.</small>`}</div>`;
    els.sessionDialog.showModal();
  }

  function deleteActiveSession() {
    const id = state.activeDialogSessionId;
    const s = state.sessions.find(x => x.id === id);
    if (!s) return;
    const student = getStudent(s.studentId);
    if (!window.confirm(`هل تريد حذف جلسة ${student?.name || "الطالب"} بتاريخ ${formatDate(s.date)}؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    state.sessions = state.sessions.filter(x => x.id !== id);
    persistSessions();
    els.sessionDialog.close();
    state.activeDialogSessionId = null;
    renderAll();
    showToast("تم حذف الجلسة");
  }

  function openStudentDialog(studentId = null) {
    const student = studentId ? getStudent(studentId) : null;
    state.activeStudentId = student?.id || null;
    els.studentDialogTitle.textContent = student ? "تعديل بيانات الطالب" : "إضافة طالب جديد";
    els.studentIdField.value = student?.id || "";
    els.studentNameField.value = student?.name || "";
    els.studentAddressField.value = student?.address || "";
    els.studentPricingType.value = student?.pricingType || "hourly";
    els.studentRateField.value = student?.rate || "";
    updateStudentRateLabel();

    if (student) {
      els.archiveStudentBtn.classList.remove("hidden-field");
      els.archiveStudentBtn.textContent = student.active ? "أرشفة الطالب" : "إعادة تفعيل الطالب";
      const hasSessions = state.sessions.some(s => s.studentId === student.id);
      els.deleteStudentBtn.classList.toggle("hidden-field", hasSessions);
    } else {
      els.archiveStudentBtn.classList.add("hidden-field");
      els.deleteStudentBtn.classList.add("hidden-field");
    }

    els.studentDialog.showModal();
    window.setTimeout(() => els.studentNameField.focus(), 50);
  }

  function closeStudentDialog() {
    if (els.studentDialog.open) els.studentDialog.close();
    state.activeStudentId = null;
    els.studentForm.reset();
  }

  function updateStudentRateLabel() {
    els.studentRateLabel.textContent = els.studentPricingType.value === "session" ? "مبلغ الجلسة" : "سعر الساعة";
  }

  function saveStudent(event) {
    event.preventDefault();
    const name = els.studentNameField.value.trim();
    const address = els.studentAddressField.value.trim();
    const rate = safeNumber(els.studentRateField.value);
    const pricingType = els.studentPricingType.value === "session" ? "session" : "hourly";
    const id = state.activeStudentId;

    if (!name) return showToast("أدخل اسم الطالب", "error");
    if (rate <= 0) return showToast("أدخل سعراً صحيحاً للطالب", "error");
    const duplicate = state.students.find(s => s.id !== id && s.name.trim().toLowerCase() === name.toLowerCase() && s.active);
    if (duplicate) return showToast("يوجد طالب حالي بنفس الاسم", "error");

    setButtonLoading(els.saveStudentBtn, true);
    if (id) {
      const student = getStudent(id);
      if (!student) return;
      student.name = name;
      student.address = address;
      student.rate = rate;
      student.pricingType = pricingType;
      student.updatedAt = new Date().toISOString();
    } else {
      state.students.push(normalizeStudent({ id: `stu-${uid()}`, name, address, rate, pricingType, active: true, createdAt: new Date().toISOString() }));
    }
    persistStudents();
    populateStudentControls();
    renderAll();
    window.setTimeout(() => {
      setButtonLoading(els.saveStudentBtn, false);
      closeStudentDialog();
      showToast(id ? "تم تحديث بيانات الطالب" : "تمت إضافة الطالب بنجاح");
    }, 140);
  }

  function toggleArchiveStudent() {
    const student = getStudent(state.activeStudentId);
    if (!student) return;
    if (student.active) {
      if (!window.confirm(`أرشفة ${student.name}؟ سيختفي من قائمة إضافة الجلسة، لكن سيبقى سجله القديم محفوظاً.`)) return;
      student.active = false;
      showToast("تمت أرشفة الطالب مع الاحتفاظ بسجله");
    } else {
      student.active = true;
      showToast("تمت إعادة تفعيل الطالب");
    }
    student.updatedAt = new Date().toISOString();
    persistStudents();
    closeStudentDialog();
    renderAll();
  }

  function deleteStudentPermanently() {
    const student = getStudent(state.activeStudentId);
    if (!student) return;
    if (state.sessions.some(s => s.studentId === student.id)) return showToast("لا يمكن حذف طالب لديه جلسات؛ استخدم الأرشفة", "error");
    if (!window.confirm(`حذف ${student.name} نهائياً؟`)) return;
    state.students = state.students.filter(s => s.id !== student.id);
    persistStudents();
    closeStudentDialog();
    renderAll();
    showToast("تم حذف الطالب");
  }

  function renderStudentManagement() {
    if (!els.studentManagementList) return;
    const q = els.studentSearch.value.trim().toLowerCase();
    const filter = els.studentStateFilter.value;
    const list = state.students.filter(student => {
      if (filter === "active" && !student.active) return false;
      if (filter === "archived" && student.active) return false;
      if (q && !`${student.name} ${student.address}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort(sortStudents);

    els.studentManagementList.innerHTML = list.map(student => {
      const rows = state.sessions.filter(s => s.studentId === student.id);
      const debt = sum(rows, s => getRemaining(s));
      const hours = sum(rows, s => s.hours);
      return `<article class="student-manage-card ${student.active ? "" : "archived"}">
        <div class="student-manage-main">
          <div class="student-avatar large">${escapeHtml(student.name.charAt(0))}</div>
          <div class="student-manage-info">
            <div class="name-line"><strong>${escapeHtml(student.name)}</strong>${student.active ? `<span class="active-chip">حالي</span>` : `<span class="archived-chip">مؤرشف</span>`}</div>
            <span class="price-line">${pricingText(student)}</span>
            <small>${student.address ? `📍 ${escapeHtml(student.address)}` : "لا يوجد عنوان مسجل"}</small>
          </div>
          <button class="edit-student-button" type="button" data-edit-student="${escapeHtml(student.id)}">تعديل</button>
        </div>
        <div class="student-manage-stats">
          <div><span>الجلسات</span><b>${toArabicDigits(rows.length)}</b></div>
          <div><span>الساعات</span><b>${formatHours(hours)}</b></div>
          <div><span>المتبقي</span><b class="${debt ? "danger-text" : "success-text"}">${formatMoney(debt)}</b></div>
        </div>
        ${student.active ? `<button class="quick-session-button" type="button" data-new-session-student="${escapeHtml(student.id)}">＋ إضافة جلسة لهذا الطالب</button>` : ""}
      </article>`;
    }).join("");
    els.studentsEmpty.classList.toggle("hidden-field", list.length > 0);
  }

  function startSessionForStudent(studentId) {
    const student = getStudent(studentId);
    if (!student || !student.active) return;
    switchView("entry");
    els.studentSelect.value = student.id;
    updateRateHint();
    updateSessionPreview();
    scrollElementIntoView(els.sessionForm);
  }

  function filterByPeriod(sessions, period) {
    const today = toDateInputValue(new Date());
    const month = today.slice(0,7);
    if (period === "today") return sessions.filter(s => s.date === today);
    if (period === "month") return sessions.filter(s => s.date.startsWith(month));
    return sessions;
  }

  function exportBackup() {
    const payload = { app: "Darsi", version: BACKUP_VERSION, exportedAt: new Date().toISOString(), students: state.students, sessions: state.sessions };
    downloadText(`darsi-backup-${toDateInputValue(new Date())}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    showToast("تم تصدير نسخة احتياطية للطلاب والجلسات");
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const sessionsRaw = Array.isArray(data) ? data : data.sessions;
      if (!Array.isArray(sessionsRaw)) throw new Error("Invalid backup");
      const normalizedSessions = sessionsRaw.map(normalizeSession).filter(Boolean);
      const normalizedStudents = Array.isArray(data.students) ? data.students.map(normalizeStudent).filter(Boolean) : state.students;
      if (!window.confirm(`سيتم استبدال البيانات الحالية واستيراد ${normalizedSessions.length} جلسة و${normalizedStudents.length} طالب. هل تريد المتابعة؟`)) return;
      state.sessions = normalizedSessions;
      state.students = normalizedStudents.length ? normalizedStudents : DEFAULT_STUDENTS.map(normalizeStudent);
      ensureStudentsForLegacySessions();
      persistAll();
      renderAll();
      showToast("تم استيراد النسخة الاحتياطية بنجاح");
    } catch (error) {
      console.error(error);
      showToast("ملف النسخة الاحتياطية غير صالح", "error");
    }
  }

  function exportCsv() {
    const headers = ["التاريخ","الطالب","العنوان","المادة","الساعات","طريقة التسعير","السعر","الإجمالي","المدفوع","المتبقي","الحالة","الملاحظات"];
    const rows = [...state.sessions].sort((a,b) => b.date.localeCompare(a.date)).map(s => {
      const st = getStudent(s.studentId); const sub = SUBJECTS[s.subject];
      return [s.date, st?.name || "", st?.address || "", sub?.name || "", s.hours, s.pricingType === "session" ? "للجلسة" : "بالساعة", s.unitRate || s.hourlyRate, s.total, s.paid, getRemaining(s), STATUS_LABELS[getStatus(s)], s.note || ""];
    });
    const csv = "\ufeff" + [headers, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");
    downloadText(`darsi-sessions-${toDateInputValue(new Date())}.csv`, csv, "text/csv;charset=utf-8");
    showToast("تم تصدير سجل الجلسات CSV");
  }

  function registerPwa() {
    if (!("serviceWorker" in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register("./service-worker.js").catch(error => console.warn("Service worker registration failed:", error));
  }

  async function installPwa() {
    if (!state.deferredInstallPrompt) {
      showToast("للتثبيت افتح قائمة المتصفح واختر إضافة إلى الشاشة الرئيسية", "error");
      return;
    }
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    els.installAppBtn.classList.add("hidden-field");
  }

  function statusPill(status) { return `<span class="status-pill ${status}">${STATUS_LABELS[status]}</span>`; }
  function getStatus(session) { if (session.paid >= session.total && session.total > 0) return "paid"; if (session.paid > 0) return "partial"; return "unpaid"; }
  function getRemaining(session) { return Math.max(0, safeNumber(session.total) - safeNumber(session.paid)); }
  function getStudent(id) { return state.students.find(s => s.id === id) || null; }
  function pricingText(student) { return `${formatMoney(student.rate)} ${student.pricingType === "session" ? "/ جلسة" : "/ ساعة"}`; }
  function sum(items, getter) { return items.reduce((acc, item) => acc + safeNumber(getter(item)), 0); }
  function safeNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
  function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`; }
  function sortStudents(a,b) { return a.name.localeCompare(b.name, "ar"); }
  function sortSessionsNewest(a,b) { return (b.date + b.createdAt).localeCompare(a.date + a.createdAt); }

  function formatMoney(value) { return `${new Intl.NumberFormat("ar-SY", { maximumFractionDigits: 0 }).format(Math.round(safeNumber(value)))} ل.س`; }
  function compactMoney(value) {
    const n = safeNumber(value);
    if (n >= 1000000) return `${toArabicDigits((n / 1000000).toFixed(n % 1000000 ? 1 : 0))}م`;
    if (n >= 1000) return `${toArabicDigits((n / 1000).toFixed(n % 1000 ? 1 : 0))}ألف`;
    return toArabicDigits(n);
  }
  function formatHours(value) { const n = safeNumber(value); return toArabicDigits(Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)); }
  function formatDate(value) {
    if (!value) return "—";
    const [y,m,d] = value.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat("ar-SY", { day: "numeric", month: "short", year: "numeric" }).format(date);
  }
  function toDateInputValue(date) { const y = date.getFullYear(); const m = String(date.getMonth()+1).padStart(2,"0"); const d = String(date.getDate()).padStart(2,"0"); return `${y}-${m}-${d}`; }
  function toArabicDigits(value) { return String(value).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
  function csvEscape(value) { const s = String(value ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; }
  function scrollElementIntoView(el) { try { el?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (_) {} }

  function downloadText(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function setButtonLoading(button, loading) {
    if (!button) return;
    button.disabled = loading;
    button.classList.toggle("loading", loading);
    const icon = button.querySelector("b");
    if (icon) icon.textContent = loading ? "◌" : (button === els.saveDebtBtn || button === els.saveStudentBtn ? "✓" : "←");
  }

  let toastTimer;
  function showToast(message, type = "success") {
    window.clearTimeout(toastTimer);
    els.toastText.textContent = message;
    const icon = els.toast.querySelector("span");
    icon.textContent = type === "error" ? "!" : "✓";
    icon.style.background = type === "error" ? "var(--red)" : "var(--green)";
    els.toast.classList.add("show");
    toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 2800);
  }

  init();
})();
