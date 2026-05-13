import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const NS = "[notes]";

function log(...args) {
  console.log(NS, ...args);
}

function warn(...args) {
  console.warn(NS, ...args);
}

function logError(...args) {
  console.error(NS, ...args);
}

function isConfigPlaceholder() {
  return (
    !firebaseConfig.apiKey ||
    firebaseConfig.apiKey === "YOUR_API_KEY" ||
    !firebaseConfig.projectId ||
    firebaseConfig.projectId === "YOUR_PROJECT_ID"
  );
}

const els = {
  configBanner: document.getElementById("config-banner"),
  authPanel: document.getElementById("auth-panel"),
  appShell: document.getElementById("app-shell"),
  authForm: document.getElementById("auth-form"),
  authEmail: document.getElementById("auth-email"),
  authPassword: document.getElementById("auth-password"),
  authError: document.getElementById("auth-error"),
  authSubmit: document.getElementById("auth-submit"),
  btnLogout: document.getElementById("btn-logout"),
  topicsList: document.getElementById("topics-list"),
  btnAddTopic: document.getElementById("btn-add-topic"),
  notesList: document.getElementById("notes-list"),
  btnAddNote: document.getElementById("btn-add-note"),
  editorEmpty: document.getElementById("editor-empty"),
  editorPanel: document.getElementById("editor-panel"),
  noteTitle: document.getElementById("note-title"),
  noteBody: document.getElementById("note-body"),
  saveStatus: document.getElementById("save-status"),
  btnDeleteNote: document.getElementById("btn-delete-note"),
  btnMenu: document.getElementById("btn-menu"),
  topicsColumn: document.getElementById("topics-column"),
  notesColumn: document.getElementById("notes-column"),
  btnToggleTopics: document.getElementById("btn-toggle-topics"),
  btnToggleNotes: document.getElementById("btn-toggle-notes"),
  navOverlay: document.getElementById("nav-overlay"),
  topicTitle: document.getElementById("topic-title"),
};

const missingDomIds = Object.entries(els)
  .filter(([, el]) => !el)
  .map(([id]) => id);
if (missingDomIds.length) {
  logError("Missing DOM elements (ids):", missingDomIds.join(", "));
}

function maskEmail(email) {
  if (!email || typeof email !== "string") return "(none)";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const safeLocal = local.length <= 2 ? "*" : `${local[0]}***${local[local.length - 1]}`;
  return `${safeLocal}@${domain}`;
}

let app;
let auth;
let db;
let unsubTopics = null;
let unsubNotes = null;

/** Firestore writes must never run without a live Firebase session. */
function requireCurrentUid() {
  const u = auth && auth.currentUser;
  if (!u || !u.uid) {
    warn("Blocked: not signed in (no Firebase user).");
    return null;
  }
  return u.uid;
}

let state = {
  uid: null,
  topics: [],
  notes: [],
  selectedTopicId: null,
  selectedNoteId: null,
  /** @type {{ title: string, body: string } | null} */
  draft: null,
  dirty: false,
  saveTimer: null,
  saving: false,
  topicSaveTimer: null,
};

function setSaveStatus(text, kind = "idle") {
  els.saveStatus.textContent = text;
  els.saveStatus.dataset.kind = kind;
}

function closeMobileNav() {
  document.body.classList.remove("nav-open");
}

function topicsCollectionRef(uid) {
  return collection(db, "users", uid, "topics");
}

function notesCollectionRef(uid, topicId) {
  return collection(db, "users", uid, "topics", topicId, "notes");
}

function noteDocRef(uid, topicId, noteId) {
  return doc(db, "users", uid, "topics", topicId, "notes", noteId);
}

function topicDocRef(uid, topicId) {
  return doc(db, "users", uid, "topics", topicId);
}

function syncTopicHeader() {
  const t = state.topics.find((x) => x.id === state.selectedTopicId);
  if (!els.topicTitle) return;
  if (!t) {
    els.topicTitle.value = "";
    els.topicTitle.disabled = true;
    return;
  }
  els.topicTitle.disabled = false;
  if (document.activeElement !== els.topicTitle) {
    els.topicTitle.value = t.title || "";
  }
}

const DELETE_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

function renderTopics() {
  els.topicsList.innerHTML = "";
  state.topics.forEach((t) => {
    const li = document.createElement("li");
    li.className = "list-row";

    const main = document.createElement("button");
    main.type = "button";
    main.className = "topic-item" + (t.id === state.selectedTopicId ? " active" : "");
    main.textContent = t.title || "Untitled topic";
    main.addEventListener("click", () => {
      void selectTopic(t.id);
      closeMobileNav();
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "row-delete-btn";
    del.setAttribute("aria-label", "Delete topic");
    del.innerHTML = DELETE_ICON_SVG;
    del.addEventListener("click", (ev) => {
      ev.stopPropagation();
      void deleteTopicById(t.id);
    });

    li.appendChild(main);
    li.appendChild(del);
    els.topicsList.appendChild(li);
  });
  syncTopicHeader();
}

function renderNotes() {
  els.notesList.innerHTML = "";
  if (!state.selectedTopicId) {
    els.btnAddNote.disabled = true;
    syncTopicHeader();
    return;
  }
  els.btnAddNote.disabled = false;
  state.notes.forEach((n) => {
    const li = document.createElement("li");
    li.className = "list-row";

    const main = document.createElement("button");
    main.type = "button";
    main.className = "note-item" + (n.id === state.selectedNoteId ? " active" : "");
    main.textContent = n.title || "Untitled note";
    main.addEventListener("click", () => {
      void selectNote(n.id);
      closeMobileNav();
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "row-delete-btn";
    del.setAttribute("aria-label", "Delete note");
    del.innerHTML = DELETE_ICON_SVG;
    del.addEventListener("click", (ev) => {
      ev.stopPropagation();
      void deleteNoteById(n.id);
    });

    li.appendChild(main);
    li.appendChild(del);
    els.notesList.appendChild(li);
  });
}

function showEditorEmpty() {
  els.editorEmpty.hidden = false;
  els.editorPanel.hidden = true;
  els.noteTitle.value = "";
  els.noteBody.value = "";
  els.btnDeleteNote.disabled = true;
  state.draft = null;
  state.dirty = false;
  syncTopicHeader();
}

function showEditor(note) {
  els.editorEmpty.hidden = true;
  els.editorPanel.hidden = false;
  els.noteTitle.value = note.title || "";
  els.noteBody.value = note.body || "";
  els.btnDeleteNote.disabled = false;
  state.draft = { title: note.title || "", body: note.body || "" };
  state.dirty = false;
  setSaveStatus("Saved", "saved");
}

async function selectTopic(topicId) {
  if (state.selectedTopicId === topicId) return;
  if (state.dirty && state.selectedNoteId) {
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }
    const ok = await flushSave();
    if (!ok) return;
  }
  state.selectedTopicId = topicId;
  state.selectedNoteId = null;
  state.notes = [];
  showEditorEmpty();
  renderTopics();
  renderNotes();
  attachNotesListener();
}

async function selectNote(noteId) {
  const note = state.notes.find((n) => n.id === noteId);
  if (!note) return;
  if (state.dirty) {
    const ok = await flushSave();
    if (!ok) return;
  }
  state.selectedNoteId = noteId;
  renderNotes();
  renderTopics();
  showEditor(note);
}

function attachTopicsListener() {
  if (!requireCurrentUid() || !state.uid) {
    warn("attachTopicsListener: skipped (no user)");
    return;
  }
  if (unsubTopics) unsubTopics();
  const uid = state.uid;
  log("Firestore: subscribe topics", { uid });
  const q = query(topicsCollectionRef(uid), orderBy("updatedAt", "desc"));
  unsubTopics = onSnapshot(
    q,
    (snap) => {
      state.topics = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      log("Firestore: topics snapshot", { count: state.topics.length, ids: state.topics.map((t) => t.id) });
      if (state.selectedTopicId && !state.topics.some((t) => t.id === state.selectedTopicId)) {
        state.selectedTopicId = null;
        state.selectedNoteId = null;
        state.notes = [];
        showEditorEmpty();
      }
      if (!state.selectedTopicId && state.topics.length) {
        void selectTopic(state.topics[0].id);
      } else {
        renderTopics();
        syncTopicHeader();
      }
    },
    (err) => {
      logError("Firestore topics listener error", err);
      setSaveStatus("Sync error", "error");
    }
  );
}

function attachNotesListener() {
  if (!requireCurrentUid()) return;
  if (unsubNotes) unsubNotes();
  unsubNotes = null;
  const { uid, selectedTopicId } = state;
  if (!selectedTopicId) {
    renderNotes();
    return;
  }
  const q = query(notesCollectionRef(uid, selectedTopicId), orderBy("updatedAt", "desc"));
  log("Firestore: subscribe notes", { topicId: selectedTopicId });
  unsubNotes = onSnapshot(
    q,
    (snap) => {
      state.notes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      log("Firestore: notes snapshot", { topicId: selectedTopicId, count: state.notes.length });
      renderNotes();
      if (state.selectedNoteId) {
        const live = state.notes.find((n) => n.id === state.selectedNoteId);
        if (!live) {
          state.selectedNoteId = null;
          showEditorEmpty();
        } else if (!state.dirty && els.editorPanel && !els.editorPanel.hidden) {
          if (
            live.title !== els.noteTitle.value ||
            (live.body || "") !== els.noteBody.value
          ) {
            showEditor(live);
          }
        }
      } else if (state.notes.length && !state.selectedNoteId) {
        void selectNote(state.notes[0].id);
      }
    },
    (err) => {
      logError("Firestore notes listener error", err);
      setSaveStatus("Sync error", "error");
    }
  );
}

async function flushSave() {
  if (!requireCurrentUid()) return true;
  if (!state.dirty || !state.uid || !state.selectedTopicId || !state.selectedNoteId) return true;
  const title = els.noteTitle.value;
  const body = els.noteBody.value;
  state.saving = true;
  setSaveStatus("Saving…", "saving");
  try {
    const tid = state.selectedTopicId;
    const nid = state.selectedNoteId;
    await updateDoc(noteDocRef(state.uid, tid, nid), {
      title,
      body,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(topicDocRef(state.uid, tid), { updatedAt: serverTimestamp() });
    state.draft = { title, body };
    state.dirty = false;
    setSaveStatus("Saved", "saved");
    return true;
  } catch (e) {
    console.error(e);
    setSaveStatus("Save failed", "error");
    return false;
  } finally {
    state.saving = false;
  }
}

function scheduleSave() {
  if (state.saveTimer) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    state.saveTimer = null;
    flushSave();
  }, 900);
}

function onEditorInput() {
  if (!state.selectedNoteId) return;
  state.dirty = true;
  setSaveStatus("Unsaved changes", "pending");
  scheduleSave();
}

async function addTopic() {
  const uid = requireCurrentUid();
  if (!uid) return;
  const ref = await addDoc(topicsCollectionRef(uid), {
    title: "New topic",
    updatedAt: serverTimestamp(),
  });
  await selectTopic(ref.id);
  closeMobileNav();
}

async function addNote() {
  const uid = requireCurrentUid();
  if (!uid) return;
  const tid = state.selectedTopicId;
  if (!tid) return;
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }
  if (state.dirty) {
    const ok = await flushSave();
    if (!ok) return;
  }
  const ref = await addDoc(notesCollectionRef(uid, tid), {
    title: "Untitled",
    body: "",
    updatedAt: serverTimestamp(),
  });
  await updateDoc(topicDocRef(uid, tid), { updatedAt: serverTimestamp() });
  state.selectedNoteId = ref.id;
  state.dirty = false;
  showEditor({ title: "Untitled", body: "" });
  closeMobileNav();
}

async function purgeTopicNotesAndDoc(uid, tid) {
  const nref = notesCollectionRef(uid, tid);
  const snap = await getDocs(nref);
  let batch = writeBatch(db);
  let n = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    n++;
    if (n >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
  await deleteDoc(topicDocRef(uid, tid));
}

async function deleteNoteById(noteId) {
  const uid = requireCurrentUid();
  const tid = state.selectedTopicId;
  if (!uid || !tid) return;
  if (state.selectedNoteId === noteId && state.dirty) {
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }
    const ok = await flushSave();
    if (!ok) return;
  }
  if (!confirm("Delete this note?")) return;
  await deleteDoc(noteDocRef(uid, tid, noteId));
  await updateDoc(topicDocRef(uid, tid), { updatedAt: serverTimestamp() });
  if (state.selectedNoteId === noteId) {
    state.selectedNoteId = null;
    showEditorEmpty();
  }
}

async function deleteTopicById(topicId) {
  const uid = requireCurrentUid();
  if (!uid || !topicId) return;
  if (topicId === state.selectedTopicId && state.dirty && state.selectedNoteId) {
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }
    const ok = await flushSave();
    if (!ok) return;
  }
  if (!confirm("Delete this topic and all notes inside it?")) return;
  if (topicId === state.selectedTopicId && state.topicSaveTimer) {
    clearTimeout(state.topicSaveTimer);
    state.topicSaveTimer = null;
  }
  await purgeTopicNotesAndDoc(uid, topicId);
  if (state.selectedTopicId === topicId) {
    state.selectedTopicId = null;
    state.selectedNoteId = null;
    state.notes = [];
    showEditorEmpty();
    if (unsubNotes) {
      unsubNotes();
      unsubNotes = null;
    }
  }
  renderTopics();
  renderNotes();
}

async function deleteCurrentNote() {
  const nid = state.selectedNoteId;
  if (!nid) return;
  await deleteNoteById(nid);
}

async function deleteCurrentTopic() {
  const tid = state.selectedTopicId;
  if (!tid) return;
  await deleteTopicById(tid);
}

function scheduleTopicSave() {
  if (state.topicSaveTimer) clearTimeout(state.topicSaveTimer);
  state.topicSaveTimer = setTimeout(() => {
    state.topicSaveTimer = null;
    void saveTopicTitleNow();
  }, 600);
}

async function saveTopicTitleNow() {
  const uid = requireCurrentUid();
  const tid = state.selectedTopicId;
  if (!uid || !tid || !els.topicTitle) return;
  const title = els.topicTitle.value.trim() || "Untitled topic";
  try {
    await updateDoc(topicDocRef(uid, tid), {
      title,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.error(e);
  }
}

function onTopicTitleInput() {
  if (!state.selectedTopicId) return;
  scheduleTopicSave();
}

function wireEditor() {
  els.noteTitle.addEventListener("input", onEditorInput);
  els.noteBody.addEventListener("input", onEditorInput);
  if (els.topicTitle) {
    els.topicTitle.addEventListener("input", onTopicTitleInput);
    els.topicTitle.addEventListener("blur", () => {
      if (state.topicSaveTimer) {
        clearTimeout(state.topicSaveTimer);
        state.topicSaveTimer = null;
      }
      void saveTopicTitleNow();
    });
  }
  window.addEventListener("beforeunload", (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

function wireChrome() {
  els.btnAddTopic.addEventListener("click", () => addTopic().catch(console.error));
  els.btnAddNote.addEventListener("click", () => addNote().catch(console.error));
  els.btnDeleteNote.addEventListener("click", () => deleteCurrentNote().catch(console.error));
  els.btnLogout.addEventListener("click", () => signOut(auth).catch(console.error));

  function wireRailToggle(btn, col, label) {
    if (!btn || !col) return;
    btn.addEventListener("click", () => {
      const collapsed = col.classList.toggle("rail-column--collapsed");
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.setAttribute("aria-label", collapsed ? `Expand ${label} panel` : `Collapse ${label} panel`);
      btn.textContent = collapsed ? "›" : "‹";
    });
  }
  wireRailToggle(els.btnToggleTopics, els.topicsColumn, "topics");
  wireRailToggle(els.btnToggleNotes, els.notesColumn, "notes");

  els.btnMenu.addEventListener("click", () => {
    document.body.classList.toggle("nav-open");
  });
  els.navOverlay.addEventListener("click", closeMobileNav);

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      flushSave().catch(console.error);
    }
  });
}

function showAuth() {
  log("UI: show auth panel");
  els.appShell.hidden = true;
  els.authPanel.hidden = false;
}

function showApp() {
  log("UI: show app shell (signed in)");
  els.authPanel.hidden = true;
  els.appShell.hidden = false;
}

function boot() {
  log("boot() start", {
    href: window.location.href,
    origin: window.location.origin,
    placeholderConfig: isConfigPlaceholder(),
  });

  if (isConfigPlaceholder()) {
    warn("Firebase config still has placeholders; sign-in disabled.");
    els.configBanner.hidden = false;
    els.authSubmit.disabled = true;
    document.body.classList.add("has-config-banner");
  }

  if (!els.authForm) {
    logError("auth-form not found; cannot attach submit listener.");
    return;
  }

  wireChrome();
  wireEditor();
  log("Wired chrome + editor listeners");

  /** Never use a real form POST (e.g. python http.server returns 501 for POST). */
  els.authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    log("auth form: submit prevented (use Sign in or Enter)");
  });

  async function performSignIn() {
    log("performSignIn()");
    els.authError.textContent = "";
    const email = els.authEmail.value.trim();
    const password = els.authPassword.value;
    log("auth: values", {
      emailMask: maskEmail(email),
      passwordLength: password ? password.length : 0,
    });
    if (!email) {
      warn("validation: empty email");
      els.authError.textContent = "Enter your email address.";
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      warn("validation: invalid email format");
      els.authError.textContent = "Enter a valid email address.";
      return;
    }
    if (!password) {
      warn("validation: empty password");
      els.authError.textContent = "Enter your password.";
      return;
    }
    const submitLabel = els.authSubmit.textContent;
    els.authSubmit.disabled = true;
    els.authSubmit.textContent = "Signing in…";
    log("calling signInWithEmailAndPassword…");
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      log("signInWithEmailAndPassword resolved", {
        uid: cred.user.uid,
        emailMask: maskEmail(cred.user.email || ""),
      });
    } catch (err) {
      const code = err && err.code;
      const map = {
        "auth/invalid-email": "That email address does not look valid.",
        "auth/user-disabled": "This account has been disabled.",
        "auth/user-not-found": "No account found for this email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/invalid-credential": "Wrong email or password.",
        "auth/too-many-requests": "Too many attempts. Try again later.",
        "auth/network-request-failed": "Network error. Check your connection and try again.",
        "auth/operation-not-allowed": "Email/password sign-in is not enabled in the Firebase console.",
        "auth/unauthorized-domain": "This site’s domain is not allowed. Use localhost or add this host under Firebase → Authentication → Authorized domains.",
      };
      els.authError.textContent =
        map[code] || err.message || "Sign-in failed.";
      logError("sign-in rejected", { code, message: err.message, err });
    } finally {
      els.authSubmit.disabled = false;
      els.authSubmit.textContent = submitLabel;
      log("performSignIn finished (button reset)");
    }
  }

  els.authSubmit.addEventListener("click", () => {
    log("auth: Sign in clicked");
    void performSignIn();
  });

  els.authForm.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing) return;
    e.preventDefault();
    log("auth: Enter key (sign in)");
    void performSignIn();
  });

  onAuthStateChanged(auth, (user) => {
    log("onAuthStateChanged", user ? { uid: user.uid, emailMask: maskEmail(user.email || "") } : { signedIn: false });
    if (state.topicSaveTimer) {
      clearTimeout(state.topicSaveTimer);
    }
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
    }
    if (unsubTopics) {
      unsubTopics();
      unsubTopics = null;
    }
    if (unsubNotes) {
      unsubNotes();
      unsubNotes = null;
    }
    state = {
      uid: null,
      topics: [],
      notes: [],
      selectedTopicId: null,
      selectedNoteId: null,
      draft: null,
      dirty: false,
      saveTimer: null,
      saving: false,
      topicSaveTimer: null,
    };
    showEditorEmpty();
    renderTopics();
    renderNotes();

    if (!user) {
      showAuth();
      return;
    }
    state.uid = user.uid;
    showApp();
    log("attaching Firestore topics listener");
    attachTopicsListener();
  });

  log("boot() complete; waiting for auth state or user actions");
}

if (isConfigPlaceholder()) {
  warn("Edit js/firebase-config.js with your Firebase web app config before signing in.");
}

log("module: initializing Firebase app", {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
});

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  log("Firebase App + Auth + Firestore ready");
} catch (e) {
  logError("initializeApp failed (check firebase-config.js)", e);
  throw e;
}

boot();
