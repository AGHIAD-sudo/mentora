(() => {
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyCmdS2y6Yhf_WTFAN2lsigVuloaGsBD5ms",
    authDomain: "mentora-481ad.firebaseapp.com",
    projectId: "mentora-481ad",
    storageBucket: "mentora-481ad.firebasestorage.app",
    messagingSenderId: "242878590267",
    appId: "1:242878590267:web:bd9a5bc5fc44273f889b1e",
    measurementId: "G-PZNS466XJC"
  };

  if (!window.firebase) {
    console.warn("Firebase SDK was not loaded. Mentora will continue in local mode.");
    window.MentoraCloud = { available: false };
    return;
  }

  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    window.MentoraCloud = { available: false, error };
    return;
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  db.settings({ ignoreUndefinedProperties: true });
  db.enablePersistence({ synchronizeTabs: true }).catch(error => {
    if (error?.code !== "failed-precondition" && error?.code !== "unimplemented") {
      console.warn("Firestore offline persistence could not be enabled:", error);
    }
  });

  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(error => {
    console.warn("Firebase Auth local persistence could not be enabled:", error);
  });

  const clean = value => JSON.parse(JSON.stringify(value));
  const timeValue = item => {
    const value = item?.updatedAt || item?.createdAt || "1970-01-01T00:00:00.000Z";
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  function collectionRef(uid, name) {
    return db.collection("users").doc(uid).collection(name);
  }

  async function writeInChunks(operations) {
    for (let start = 0; start < operations.length; start += 400) {
      const batch = db.batch();
      operations.slice(start, start + 400).forEach(op => {
        if (op.type === "delete") batch.delete(op.ref);
        else batch.set(op.ref, clean(op.data), { merge: false });
      });
      await batch.commit();
    }
  }

  async function mergeCollection(uid, name, localItems) {
    const ref = collectionRef(uid, name);
    let snapshot;
    try {
      snapshot = await ref.get({ source: "server" });
    } catch (_) {
      snapshot = await ref.get();
    }

    const remote = new Map(snapshot.docs.map(doc => [doc.id, doc.data()]));
    const operations = [];

    (localItems || []).forEach(item => {
      if (!item?.id) return;
      const existing = remote.get(String(item.id));
      if (!existing || timeValue(item) > timeValue(existing)) {
        operations.push({ type: "set", ref: ref.doc(String(item.id)), data: item });
      }
    });

    if (operations.length) await writeInChunks(operations);
  }

  async function mergeLocalData(uid, students, sessions) {
    await mergeCollection(uid, "students", students);
    await mergeCollection(uid, "sessions", sessions);
  }

  function subscribe(uid, handlers = {}) {
    const unsubs = [];
    let firstStudents = false;
    let firstSessions = false;
    let studentsFromCache = false;
    let sessionsFromCache = false;

    const reportReady = () => {
      if (!firstStudents || !firstSessions) return;
      handlers.onStatus?.(studentsFromCache || sessionsFromCache ? "offline" : "synced");
    };

    unsubs.push(collectionRef(uid, "students").onSnapshot({ includeMetadataChanges: true }, snapshot => {
      firstStudents = true;
      studentsFromCache = snapshot.metadata.fromCache;
      handlers.onStudents?.(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      if (snapshot.metadata.hasPendingWrites) handlers.onStatus?.("syncing");
      else reportReady();
    }, error => handlers.onError?.(error)));

    unsubs.push(collectionRef(uid, "sessions").onSnapshot({ includeMetadataChanges: true }, snapshot => {
      firstSessions = true;
      sessionsFromCache = snapshot.metadata.fromCache;
      handlers.onSessions?.(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      if (snapshot.metadata.hasPendingWrites) handlers.onStatus?.("syncing");
      else reportReady();
    }, error => handlers.onError?.(error)));

    return () => unsubs.forEach(unsub => {
      try { unsub(); } catch (_) {}
    });
  }

  async function upsertStudent(uid, student) {
    if (!student?.id) throw new Error("Student id is required");
    await collectionRef(uid, "students").doc(String(student.id)).set(clean(student), { merge: true });
  }

  async function deleteStudent(uid, studentId) {
    await collectionRef(uid, "students").doc(String(studentId)).delete();
  }

  async function upsertSession(uid, session) {
    if (!session?.id) throw new Error("Session id is required");
    await collectionRef(uid, "sessions").doc(String(session.id)).set(clean(session), { merge: true });
  }

  async function deleteSession(uid, sessionId) {
    await collectionRef(uid, "sessions").doc(String(sessionId)).delete();
  }

  async function replaceCollection(uid, name, items) {
    const ref = collectionRef(uid, name);
    const snapshot = await ref.get();
    const wanted = new Map((items || []).filter(x => x?.id).map(x => [String(x.id), x]));
    const operations = [];

    snapshot.docs.forEach(doc => {
      if (!wanted.has(doc.id)) operations.push({ type: "delete", ref: doc.ref });
    });
    wanted.forEach((data, id) => operations.push({ type: "set", ref: ref.doc(id), data }));
    if (operations.length) await writeInChunks(operations);
  }

  async function replaceAll(uid, students, sessions) {
    await replaceCollection(uid, "students", students);
    await replaceCollection(uid, "sessions", sessions);
  }

  window.MentoraCloud = {
    available: true,
    config: { projectId: firebaseConfig.projectId },
    onAuthStateChanged: callback => auth.onAuthStateChanged(callback),
    signIn: (email, password) => auth.signInWithEmailAndPassword(email.trim(), password),
    signOut: () => auth.signOut(),
    currentUser: () => auth.currentUser,
    mergeLocalData,
    subscribe,
    upsertStudent,
    deleteStudent,
    upsertSession,
    deleteSession,
    replaceAll
  };
})();
