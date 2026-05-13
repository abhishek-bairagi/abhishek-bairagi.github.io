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
  btnDeleteTopic: document.getElementById("btn-delete-topic"),
  btnMenu: document.getElementById("btn-menu"),
  navOverlay: document.getElementById("nav-overlay"),
  topicTitle: document.getElementById("topic-title"),
};

let app;
let auth;
let db;
let unsubTopics = null;
let unsubNotes = null;

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
    els.btnDeleteTopic.disabled = true;
    return;
  }
  els.topicTitle.disabled = false;
  els.btnDeleteTopic.disabled = false;
  if (document.activeElement !== els.topicTitle) {
    els.topicTitle.value = t.title || "";
  }
}

function renderTopics() {
  els.topicsList.innerHTML = "";
  state.topics.forEach((t) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "topic-item" + (t.id === state.selectedTopicId ? " active" : "");
    btn.textContent = t.title || "Untitled topic";
    btn.addEventListener("click", () => {
      void selectTopic(t.id);
      closeMobileNav();
    });
    li.appendChild(btn);
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
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "note-item" + (n.id === state.selectedNoteId ? " active" : "");
    btn.textContent = n.title || "Untitled note";
    btn.addEventListener("click", () => {
      void selectNote(n.id);
      closeMobileNav();
    });
    li.appendChild(btn);
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
  if (unsubTopics) unsubTopics();
  const uid = state.uid;
  const q = query(topicsCollectionRef(uid), orderBy("updatedAt", "desc"));
  unsubTopics = onSnapshot(
    q,
    (snap) => {
      state.topics = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
      console.error(err);
      setSaveStatus("Sync error", "error");
    }
  );
}

function attachNotesListener() {
  if (unsubNotes) unsubNotes();
  unsubNotes = null;
  const { uid, selectedTopicId } = state;
  if (!selectedTopicId) {
    renderNotes();
    return;
  }
  const q = query(notesCollectionRef(uid, selectedTopicId), orderBy("updatedAt", "desc"));
  unsubNotes = onSnapshot(
    q,
    (snap) => {
      state.notes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
      console.error(err);
      setSaveStatus("Sync error", "error");
    }
  );
}

async function flushSave() {
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
  const uid = state.uid;
  const ref = await addDoc(topicsCollectionRef(uid), {
    title: "New topic",
    updatedAt: serverTimestamp(),
  });
  await selectTopic(ref.id);
  closeMobileNav();
}

async function addNote() {
  const uid = state.uid;
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

async function deleteCurrentNote() {
  const uid = state.uid;
  const tid = state.selectedTopicId;
  const nid = state.selectedNoteId;
  if (!tid || !nid) return;
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }
  if (state.dirty) {
    const ok = await flushSave();
    if (!ok) return;
  }
  if (!confirm("Delete this note?")) return;
  await deleteDoc(noteDocRef(uid, tid, nid));
  await updateDoc(topicDocRef(uid, tid), { updatedAt: serverTimestamp() });
  state.selectedNoteId = null;
  showEditorEmpty();
}

async function deleteCurrentTopic() {
  const uid = state.uid;
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
  if (!confirm("Delete this topic and all notes inside it?")) return;
  if (state.topicSaveTimer) {
    clearTimeout(state.topicSaveTimer);
    state.topicSaveTimer = null;
  }
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
  state.selectedTopicId = null;
  state.selectedNoteId = null;
  state.notes = [];
  showEditorEmpty();
  renderTopics();
  renderNotes();
}

function scheduleTopicSave() {
  if (state.topicSaveTimer) clearTimeout(state.topicSaveTimer);
  state.topicSaveTimer = setTimeout(() => {
    state.topicSaveTimer = null;
    void saveTopicTitleNow();
  }, 600);
}

async function saveTopicTitleNow() {
  const uid = state.uid;
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
  els.btnDeleteTopic.addEventListener("click", () => deleteCurrentTopic().catch(console.error));
  els.btnLogout.addEventListener("click", () => signOut(auth).catch(console.error));

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
  els.appShell.hidden = true;
  els.authPanel.hidden = false;
}

function showApp() {
  els.authPanel.hidden = true;
  els.appShell.hidden = false;
}

function boot() {
  if (isConfigPlaceholder()) {
    els.configBanner.hidden = false;
    els.authSubmit.disabled = true;
    document.body.classList.add("has-config-banner");
  }

  wireChrome();
  wireEditor();

  els.authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.authError.textContent = "";
    const email = els.authEmail.value.trim();
    const password = els.authPassword.value;
    els.authSubmit.disabled = true;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      els.authError.textContent = err.message || "Sign-in failed";
    } finally {
      els.authSubmit.disabled = false;
    }
  });

  onAuthStateChanged(auth, (user) => {
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
    attachTopicsListener();
  });
}

if (isConfigPlaceholder()) {
  console.warn(
    "[notes] Edit js/firebase-config.js with your Firebase web app config before signing in."
  );
}

app = initializeApp(firebaseConfig);
auth = getAuth(app);
db = getFirestore(app);
boot();
