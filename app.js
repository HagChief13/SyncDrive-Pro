
/* =========================================================
   SYNCDRIVE PRO
   ARCHIVO + CARPETA + DESTINO PERSISTENTE + AUTO SYNC
   ========================================================= */

"use strict";


/* =========================================================
   ESTADO
   ========================================================= */

let syncMode = "smart";

// "file" | "folder"
let selectedSourceType = null;

let selectedFiles = [];

let selectedFile = null;
let selectedFileHandle = null;

let selectedFolderHandle = null;

let destinationDirectory = null;

let activeFilter = "all";
let searchTerm = "";

let isSyncing = false;

let autoSyncEnabled = false;
let autoSyncTimer = null;

let lastKnownModified = null;
let lastKnownSize = null;

let activeObjectUrls = [];


/* =========================================================
   ELEMENTOS
   ========================================================= */

const selectFileBtn =
    document.getElementById("selectFileBtn");

const selectFolderBtn =
    document.getElementById("selectFolderBtn");

const changeFileBtn =
    document.getElementById("changeFileBtn");

const changeFolderBtn =
    document.getElementById("changeFolderBtn");

const selectedFileInfo =
    document.getElementById("selectedFileInfo");

const selectedFolderInfo =
    document.getElementById("selectedFolderInfo");

const selectedFileName =
    document.getElementById("selectedFileName");

const selectedFileDetails =
    document.getElementById("selectedFileDetails");

const selectedFolderName =
    document.getElementById("selectedFolderName");

const selectedFolderDetails =
    document.getElementById("selectedFolderDetails");

const automaticSyncPanel =
    document.getElementById("automaticSyncPanel");

const autoSyncCheckbox =
    document.getElementById("autoSyncCheckbox");

const autoSyncStatus =
    document.getElementById("autoSyncStatus");

const destinationName =
    document.getElementById("destinationName");

const destinationType =
    document.getElementById("destinationType");

const destinationStatus =
    document.getElementById("destinationStatus");

const destinationStatusText =
    document.getElementById("destinationStatusText");

const destinationCheck =
    document.getElementById("destinationCheck");

const destinationIcon =
    document.getElementById("destinationIcon");

const destinationButtonText =
    document.getElementById("destinationButtonText");

const storageText =
    document.getElementById("storageText");

const storageProgress =
    document.getElementById("storageProgress");

const selectDestinationBtn =
    document.getElementById("selectDestinationBtn");

const lastDestinationPanel =
    document.getElementById("lastDestinationPanel");

const lastDestinationName =
    document.getElementById("lastDestinationName");

const useLastDestinationBtn =
    document.getElementById("useLastDestinationBtn");

const syncBtn =
    document.getElementById("syncBtn");

const filesSection =
    document.getElementById("filesSection");

const filesSummary =
    document.getElementById("filesSummary");

const filesList =
    document.getElementById("filesList");

const searchInput =
    document.getElementById("searchInput");

const folderInput =
    document.getElementById("folderInput");


/* =========================================================
   UTILIDADES
   ========================================================= */

function normalizePath(path) {

    return String(path || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");

}


function formatBytes(bytes) {

    if (!Number.isFinite(bytes)) {
        return "0 B";
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;

}


function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function showToast(message, type = "info") {

    let toast =
        document.getElementById("syncDriveToast");

    if (!toast) {

        toast =
            document.createElement("div");

        toast.id =
            "syncDriveToast";

        document.body.appendChild(toast);

    }

    toast.textContent =
        message;

    toast.className =
        `syncdrive-toast ${type}`;

    clearTimeout(toast._timer);

    toast._timer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 3000);

    requestAnimationFrame(() => {

        toast.classList.add("show");

    });

}


function setElementVisible(
    element,
    visible
) {

    if (!element) {
        return;
    }

    element.classList.toggle(
        "hidden",
        !visible
    );

}


/* =========================================================
   ACTUALIZAR BOTÓN DE SINCRONIZACIÓN
   ========================================================= */

function updateSyncButton() {

    if (!syncBtn) {
        return;
    }

    const hasSource =
        selectedSourceType === "file"
            ? !!selectedFileHandle
            : selectedSourceType === "folder"
                ? selectedFiles.length > 0
                : false;

    const hasDestination =
        !!destinationDirectory;

    const ready =
        hasSource &&
        hasDestination &&
        !isSyncing;

    syncBtn.disabled =
        !ready;


    const spans =
        syncBtn.querySelectorAll("span");


    if (!spans.length) {
        return;
    }


    if (!hasSource) {

        spans[0].textContent =
            "SELECCIONA ARCHIVOS";

        return;

    }


    if (!hasDestination) {

        spans[0].textContent =
            "SELECCIONA DESTINO";

        return;

    }


    if (isSyncing) {

        spans[0].textContent =
            "SINCRONIZANDO...";

        return;

    }


    if (selectedSourceType === "file") {

        spans[0].textContent =
            "SINCRONIZAR ARCHIVO";

        return;

    }


    if (selectedSourceType === "folder") {

        spans[0].textContent =
            "SINCRONIZAR CARPETA";

        return;

    }


    spans[0].textContent =
        "SINCRONIZAR";

}


/* =========================================================
   BASE DE DATOS INDEXEDDB
   ========================================================= */

const DB_NAME =
    "SyncDriveProDB";

const DB_VERSION =
    1;

const STORE_NAME =
    "handles";


function openDatabase() {

    return new Promise((resolve, reject) => {

        const request =
            indexedDB.open(
                DB_NAME,
                DB_VERSION
            );


        request.onupgradeneeded =
            () => {

                const db =
                    request.result;

                if (
                    !db.objectStoreNames.contains(
                        STORE_NAME
                    )
                ) {

                    db.createObjectStore(
                        STORE_NAME
                    );

                }

            };


        request.onsuccess =
            () => {

                resolve(
                    request.result
                );

            };


        request.onerror =
            () => {

                reject(
                    request.error
                );

            };

    });

}


async function saveHandle(
    key,
    handle
) {

    try {

        const db =
            await openDatabase();


        await new Promise(
            (resolve, reject) => {

                const tx =
                    db.transaction(
                        STORE_NAME,
                        "readwrite"
                    );


                tx.objectStore(
                    STORE_NAME
                ).put(
                    handle,
                    key
                );


                tx.oncomplete =
                    resolve;


                tx.onerror =
                    () => {

                        reject(
                            tx.error
                        );

                    };

            }
        );


        db.close();

    } catch (error) {

        console.warn(
            "No se pudo guardar el handle:",
            error
        );

    }

}


async function loadHandle(key) {

    try {

        const db =
            await openDatabase();


        const result =
            await new Promise(
                (resolve, reject) => {

                    const tx =
                        db.transaction(
                            STORE_NAME,
                            "readonly"
                        );


                    const request =
                        tx.objectStore(
                            STORE_NAME
                        ).get(key);


                    request.onsuccess =
                        () => {

                            resolve(
                                request.result
                            );

                        };


                    request.onerror =
                        () => {

                            reject(
                                request.error
                            );

                        };

                }
            );


        db.close();

        return result || null;

    } catch (error) {

        console.warn(
            "No se pudo cargar el handle:",
            error
        );

        return null;

    }

}


/* =========================================================
   PERMISOS
   ========================================================= */

async function ensureReadWritePermission(handle) {

    if (!handle) {
        return false;
    }

    try {

        const options = {
            mode: "readwrite"
        };


        if (
            await handle.queryPermission(
                options
            ) === "granted"
        ) {

            return true;

        }


        if (
            await handle.requestPermission(
                options
            ) === "granted"
        ) {

            return true;

        }

    } catch (error) {

        console.warn(
            "Error solicitando permiso:",
            error
        );

    }

    return false;

}


async function ensureReadPermission(handle) {

    if (!handle) {
        return false;
    }

    try {

        const options = {
            mode: "read"
        };


        if (
            await handle.queryPermission(
                options
            ) === "granted"
        ) {

            return true;

        }


        if (
            await handle.requestPermission(
                options
            ) === "granted"
        ) {

            return true;

        }

    } catch (error) {

        console.warn(
            "Error solicitando permiso:",
            error
        );

    }

    return false;

}


/* =========================================================
   SELECCIONAR ARCHIVO
   ========================================================= */

async function selectIndividualFile() {

    if (!window.showOpenFilePicker) {

        showToast(
            "Tu navegador no soporta selección avanzada de archivos.",
            "error"
        );

        return;

    }


    try {

        const handles =
            await window.showOpenFilePicker({
                multiple: false
            });


        if (
            !handles ||
            !handles.length
        ) {

            return;

        }


        const handle =
            handles[0];


        const allowed =
            await ensureReadPermission(
                handle
            );


        if (!allowed) {

            showToast(
                "No se concedió permiso para leer el archivo.",
                "error"
            );

            return;

        }


        const file =
            await handle.getFile();


        selectedFileHandle =
            handle;

        selectedFile =
            file;

        selectedSourceType =
            "file";

        selectedFiles =
            [file];

        selectedFolderHandle =
            null;


        lastKnownModified =
            file.lastModified;

        lastKnownSize =
            file.size;


        renderSelectedFile();

        renderFiles();

        updateSyncButton();


        await saveHandle(
            "lastSourceFile",
            handle
        );


        showToast(
            `Archivo seleccionado: ${file.name}`,
            "success"
        );


    } catch (error) {

        if (
            error.name === "AbortError"
        ) {

            return;

        }


        console.error(error);


        showToast(
            "No se pudo seleccionar el archivo.",
            "error"
        );

    }

}


/* =========================================================
   SELECCIONAR CARPETA
   ========================================================= */

async function selectFolder() {

    if (!window.showDirectoryPicker) {

        if (folderInput) {
            folderInput.click();
        }

        return;

    }


    try {

        const handle =
            await window.showDirectoryPicker({
                mode: "read"
            });


        const allowed =
            await ensureReadPermission(
                handle
            );


        if (!allowed) {

            showToast(
                "No se concedió permiso para leer la carpeta.",
                "error"
            );

            return;

        }


        selectedFolderHandle =
            handle;

        selectedFileHandle =
            null;

        selectedFile =
            null;

        selectedSourceType =
            "folder";

        selectedFiles =
            [];


        await collectFilesFromDirectory(
            handle,
            "",
            selectedFiles
        );


        renderSelectedFolder();

        renderFiles();

        updateSyncButton();


        showToast(
            `Carpeta seleccionada: ${handle.name}`,
            "success"
        );


    } catch (error) {

        if (
            error.name === "AbortError"
        ) {

            return;

        }


        console.error(error);


        showToast(
            "No se pudo seleccionar la carpeta.",
            "error"
        );

    }

}


/* =========================================================
   FALLBACK CARPETA
   ========================================================= */

async function handleFolderInput(event) {

    const files =
        Array.from(
            event.target.files || []
        );


    if (!files.length) {
        return;
    }


    selectedSourceType =
        "folder";

    selectedFolderHandle =
        null;

    selectedFileHandle =
        null;

    selectedFile =
        null;

    selectedFiles =
        files;


    renderSelectedFolderFallback();

    renderFiles();

    updateSyncButton();


    showToast(
        "Carpeta cargada correctamente.",
        "success"
    );

}


/* =========================================================
   LEER CARPETA RECURSIVAMENTE
   ========================================================= */

async function collectFilesFromDirectory(
    directoryHandle,
    currentPath,
    output
) {

    for await (
        const [name, handle]
        of directoryHandle.entries()
    ) {

        if (
            handle.kind === "file"
        ) {

            const file =
                await handle.getFile();


            Object.defineProperty(
                file,
                "__syncRelativePath",
                {
                    value:
                        normalizePath(
                            currentPath
                                ? `${currentPath}/${name}`
                                : name
                        ),

                    enumerable: false
                }
            );


            output.push(file);


        } else if (
            handle.kind === "directory"
        ) {

            await collectFilesFromDirectory(
                handle,
                currentPath
                    ? `${currentPath}/${name}`
                    : name,
                output
            );

        }

    }

}


/* =========================================================
   INFORMACIÓN ARCHIVO
   ========================================================= */

function renderSelectedFile() {

    setElementVisible(
        selectedFileInfo,
        true
    );


    setElementVisible(
        selectedFolderInfo,
        false
    );


    setElementVisible(
        automaticSyncPanel,
        true
    );


    if (!selectedFile) {
        return;
    }


    if (selectedFileName) {

        selectedFileName.textContent =
            selectedFile.name;

    }


    if (selectedFileDetails) {

        selectedFileDetails.textContent =
            `${formatBytes(selectedFile.size)} · ${selectedFile.type || "Archivo"}`;

    }


    if (autoSyncStatus) {

        autoSyncStatus.textContent =
            autoSyncEnabled
                ? "🟢 Sincronización automática activa"
                : "⚪ Sin sincronización automática";

    }

}


/* =========================================================
   INFORMACIÓN CARPETA
   ========================================================= */

function renderSelectedFolder() {

    setElementVisible(
        selectedFolderInfo,
        true
    );


    setElementVisible(
        selectedFileInfo,
        false
    );


    setElementVisible(
        automaticSyncPanel,
        false
    );


    if (selectedFolderName) {

        selectedFolderName.textContent =
            selectedFolderHandle
                ? selectedFolderHandle.name
                : "Carpeta seleccionada";

    }


    if (selectedFolderDetails) {

        selectedFolderDetails.textContent =
            `${selectedFiles.length} archivo(s)`;

    }

}


function renderSelectedFolderFallback() {

    setElementVisible(
        selectedFolderInfo,
        true
    );


    setElementVisible(
        selectedFileInfo,
        false
    );


    setElementVisible(
        automaticSyncPanel,
        false
    );


    let folderName =
        "Carpeta seleccionada";


    if (
        selectedFiles[0] &&
        selectedFiles[0].webkitRelativePath
    ) {

        folderName =
            selectedFiles[0]
                .webkitRelativePath
                .split("/")[0];

    }


    if (selectedFolderName) {

        selectedFolderName.textContent =
            folderName;

    }


    if (selectedFolderDetails) {

        selectedFolderDetails.textContent =
            `${selectedFiles.length} archivo(s)`;

    }

}


/* =========================================================
   RUTA RELATIVA
   ========================================================= */

function getRelativePath(file) {

    if (
        selectedSourceType === "file"
    ) {

        return normalizePath(
            file.name
        );

    }


    if (file.__syncRelativePath) {

        return normalizePath(
            file.__syncRelativePath
        );

    }


    if (file.webkitRelativePath) {

        return normalizePath(
            file.webkitRelativePath
        );

    }


    return normalizePath(
        file.name
    );

}


/* =========================================================
   LISTA DE ARCHIVOS
   ========================================================= */

function renderFiles() {

    if (!filesList) {
        return;
    }


    setElementVisible(
        filesSection,
        selectedFiles.length > 0
    );


    if (!selectedFiles.length) {

        filesList.innerHTML =
            "";

        return;

    }


    const filtered =
        selectedFiles.filter(
            file => {

                const path =
                    getRelativePath(
                        file
                    );


                const matchesSearch =
                    !searchTerm ||
                    path
                        .toLowerCase()
                        .includes(
                            searchTerm.toLowerCase()
                        );


                const matchesFilter =
                    activeFilter === "all"
                    ||
                    getFileCategory(file)
                        === activeFilter;


                return (
                    matchesSearch &&
                    matchesFilter
                );

            }
        );


    filesList.innerHTML =
        "";


    filtered.forEach(
        file => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "file-item";


            const path =
                getRelativePath(
                    file
                );


            item.innerHTML = `

                <div class="file-item-icon">
                    ${getFileIcon(file)}
                </div>

                <div class="file-item-info">

                    <strong>
                        ${escapeHtml(file.name)}
                    </strong>

                    <span>
                        ${escapeHtml(path)}
                    </span>

                </div>

                <div class="file-item-size">
                    ${formatBytes(file.size)}
                </div>

                <button
                    type="button"
                    class="file-preview-btn"
                    data-file-index="${selectedFiles.indexOf(file)}"
                >
                    Ver
                </button>

            `;


            filesList.appendChild(
                item
            );

        }
    );


    if (filesSummary) {

        filesSummary.textContent =
            `${selectedFiles.length} archivo(s)`;

    }

}


/* =========================================================
   CATEGORÍAS
   ========================================================= */

function getFileCategory(file) {

    const type =
        String(file.type || "")
            .toLowerCase();


    const name =
        file.name.toLowerCase();


    if (
        type.startsWith("image/")
        ||
        /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i
            .test(name)
    ) {

        return "image";

    }


    if (
        type.includes("pdf")
        ||
        name.endsWith(".pdf")
    ) {

        return "pdf";

    }


    if (
        /\.(doc|docx|txt|rtf|odt)$/i
            .test(name)
    ) {

        return "document";

    }


    if (
        /\.(xls|xlsx|csv|ods)$/i
            .test(name)
    ) {

        return "spreadsheet";

    }


    if (
        type.startsWith("video/")
        ||
        /\.(mp4|webm|mov|avi|mkv)$/i
            .test(name)
    ) {

        return "video";

    }


    if (
        type.startsWith("audio/")
        ||
        /\.(mp3|wav|ogg|m4a|flac)$/i
            .test(name)
    ) {

        return "audio";

    }


    return "other";

}


function getFileIcon(file) {

    const category =
        getFileCategory(file);


    const icons = {

        image: "🖼️",
        pdf: "📕",
        document: "📄",
        spreadsheet: "📊",
        video: "🎬",
        audio: "🎵",
        other: "📦"

    };


    return (
        icons[category]
        || "📦"
    );

}


/* =========================================================
   DESTINO
   ========================================================= */

async function selectDestination() {

    console.log("🟡 SELECCIONANDO DESTINO");

    if (!window.showDirectoryPicker) {

        showToast(
            "Tu navegador no soporta selección de carpetas.",
            "error"
        );

        return;
    }

    try {

        const handle =
            await window.showDirectoryPicker({
                mode: "readwrite"
            });

        console.log(
            "🟢 Carpeta elegida:",
            handle.name
        );

        const allowed =
            await ensureReadWritePermission(
                handle
            );

        if (!allowed) {

            showToast(
                "No se concedió permiso para escribir en el destino.",
                "error"
            );

            return;
        }

        destinationDirectory =
            handle;

        await saveHandle(
            "lastDestination",
            handle
        );

        localStorage.setItem(
            "SyncDrivePro_lastDestinationName",
            handle.name
        );

        renderDestination();

        updateSyncButton();

        showToast(
            `Destino seleccionado: ${handle.name}`,
            "success"
        );

        if (
            selectedSourceType === "file" &&
            autoSyncEnabled
        ) {

            await syncSingleFile();

        }

        console.log(
            "🟢 DESTINO CONFIGURADO:",
            handle.name
        );

    } catch (error) {

        if (
            error.name === "AbortError"
        ) {

            console.log(
                "🟡 Selección de destino cancelada."
            );

            return;
        }

        console.error(
            "🔴 Error seleccionando destino:",
            error
        );

        showToast(
            "No se pudo seleccionar el destino.",
            "error"
        );

    }

}


/* =========================================================
   RESTAURAR ÚLTIMO DESTINO
   ========================================================= */

async function loadLastDestination() {

    const handle =
        await loadHandle(
            "lastDestination"
        );


    if (!handle) {
        return;
    }


    const name =
        localStorage.getItem(
            "SyncDrivePro_lastDestinationName"
        )
        ||
        handle.name
        ||
        "Último destino";


    if (lastDestinationName) {

        lastDestinationName.textContent =
            name;

    }


    setElementVisible(
        lastDestinationPanel,
        true
    );

}


async function useLastDestination() {

    const handle =
        await loadHandle(
            "lastDestination"
        );


    if (!handle) {

        showToast(
            "No existe un destino guardado.",
            "error"
        );

        return;

    }


    const allowed =
        await ensureReadWritePermission(
            handle
        );


    if (!allowed) {

        showToast(
            "El permiso del destino expiró. Selecciónalo nuevamente.",
            "error"
        );

        return;

    }


    destinationDirectory =
        handle;


    renderDestination();

    updateSyncButton();


    showToast(
        `Usando último destino: ${handle.name}`,
        "success"
    );

}


/* =========================================================
   MOSTRAR DESTINO
   ========================================================= */

function renderDestination() {

    console.log("================================");
    console.log("RENDER DESTINATION");
    console.log("================================");

    console.log(
        "destinationDirectory:",
        destinationDirectory
    );

    if (!destinationDirectory) {
        console.log("⚠️ No hay destino seleccionado");
        return;
    }

    console.log(
        "📁 Nombre:",
        destinationDirectory.name
    );

    const name =
        destinationDirectory.name ||
        "Carpeta de destino";

    if (destinationName) {
        destinationName.textContent = name;
    }

    if (destinationType) {
        destinationType.textContent =
            "Carpeta de destino";
    }

    if (destinationStatus) {
        destinationStatus.textContent =
            "LISTO";
    }

    if (destinationStatusText) {
        destinationStatusText.textContent =
            "Lista para escribir";
    }

    if (destinationCheck) {
        destinationCheck.textContent = "✓";
        destinationCheck.style.display = "grid";
    }

    if (destinationIcon) {
        destinationIcon.textContent = "💾";
    }

    if (destinationButtonText) {
        destinationButtonText.textContent =
            "Cambiar carpeta";
    }

    if (storageText) {
        storageText.textContent = "LISTO";
    }

    if (storageProgress) {
        storageProgress.style.width = "100%";
    }

    console.log(
        "🟢 DESTINO RENDERIZADO:"
    );

    console.log(
        destinationName?.textContent
    );

    updateSyncButton();
}


/* =========================================================
   CREAR CARPETAS
   ========================================================= */

async function getDirectoryHandleForPath(
    rootHandle,
    path
) {

    const parts =
        normalizePath(path)
            .split("/")
            .filter(Boolean);


    let current =
        rootHandle;


    for (
        const part of parts
    ) {

        current =
            await current.getDirectoryHandle(
                part,
                {
                    create: true
                }
            );

    }


    return current;

}


/* =========================================================
   ESCRIBIR ARCHIVO
   ========================================================= */

async function writeFileToDestination(
    file,
    relativePath
) {

    if (!destinationDirectory) {

        throw new Error(
            "No hay destino seleccionado."
        );

    }


    const normalized =
        normalizePath(
            relativePath
        );


    const parts =
        normalized
            .split("/")
            .filter(Boolean);


    const fileName =
        parts.pop();


    const directoryPath =
        parts.join("/");


    let targetDirectory =
        destinationDirectory;


    if (directoryPath) {

        targetDirectory =
            await getDirectoryHandleForPath(
                destinationDirectory,
                directoryPath
            );

    }


    const fileHandle =
        await targetDirectory
            .getFileHandle(
                fileName,
                {
                    create: true
                }
            );


    const writable =
        await fileHandle.createWritable();


    try {

        await writable.write(
            file
        );

    } finally {

        await writable.close();

    }

}


/* =========================================================
   SINCRONIZAR ARCHIVO
   ========================================================= */

async function syncSingleFile(
    silent = false
) {

    if (!selectedFileHandle) {

        if (!silent) {

            showToast(
                "No hay un archivo seleccionado.",
                "error"
            );

        }

        return false;

    }


    if (!destinationDirectory) {

        if (!silent) {

            showToast(
                "Selecciona primero un destino.",
                "error"
            );

        }

        return false;

    }


    const allowed =
        await ensureReadPermission(
            selectedFileHandle
        );


    if (!allowed) {

        if (!silent) {

            showToast(
                "No hay permiso para leer el archivo.",
                "error"
            );

        }

        return false;

    }


    const file =
        await selectedFileHandle.getFile();


    isSyncing = true;

    updateSyncButton();


    try {

        await writeFileToDestination(
            file,
            file.name
        );


        selectedFile =
            file;

        selectedFiles =
            [file];


        lastKnownModified =
            file.lastModified;

        lastKnownSize =
            file.size;


        renderSelectedFile();

        renderFiles();


        if (!silent) {

            showToast(
                `✓ ${file.name} sincronizado`,
                "success"
            );

        }


        addHistory(
            `Archivo sincronizado: ${file.name}`
        );


        return true;


    } catch (error) {

        console.error(error);


        if (!silent) {

            showToast(
                `Error: ${error.message}`,
                "error"
            );

        }


        return false;


    } finally {

        isSyncing = false;

        updateSyncButton();

    }

}


/* =========================================================
   SINCRONIZAR CARPETA
   ========================================================= */

async function syncFolder() {

    if (!selectedFiles.length) {

        showToast(
            "No hay archivos seleccionados.",
            "error"
        );

        return;

    }


    if (!destinationDirectory) {

        showToast(
            "Selecciona primero un destino.",
            "error"
        );

        return;

    }


    if (isSyncing) {
        return;
    }


    isSyncing =
        true;

    updateSyncButton();


    try {

        let completed =
            0;


        updateProgress(
            0,
            selectedFiles.length
        );


        for (
            const file of selectedFiles
        ) {

            const path =
                getRelativePath(
                    file
                );


            await writeFileToDestination(
                file,
                path
            );


            completed++;


            updateProgress(
                completed,
                selectedFiles.length
            );

        }


        showToast(
            `✓ ${completed} archivo(s) sincronizados`,
            "success"
        );


        addHistory(
            `Carpeta sincronizada: ${completed} archivo(s)`
        );


    } catch (error) {

        console.error(error);


        showToast(
            `Error durante la sincronización: ${error.message}`,
            "error"
        );


    } finally {

        isSyncing =
            false;

        updateSyncButton();

    }

}


/* =========================================================
   SINCRONIZACIÓN GENERAL
   ========================================================= */

async function performSync() {

    if (isSyncing) {
        return;
    }


    if (!selectedSourceType) {

        showToast(
            "Selecciona un archivo o una carpeta.",
            "error"
        );

        return;

    }


    if (!destinationDirectory) {

        showToast(
            "Selecciona primero un destino.",
            "error"
        );

        return;

    }


    if (
        selectedSourceType === "file"
    ) {

        await syncSingleFile();

        return;

    }


    if (
        selectedSourceType === "folder"
    ) {

        await syncFolder();

        return;

    }


    showToast(
        "Selecciona un archivo o una carpeta.",
        "error"
    );

}


/* =========================================================
   SINCRONIZACIÓN AUTOMÁTICA
   ========================================================= */

function startAutoSync() {

    stopAutoSync();


    if (!selectedFileHandle) {

        updateAutoSyncStatus(
            false,
            "⚠️ Selecciona primero un archivo"
        );

        return;

    }


    if (!destinationDirectory) {

        updateAutoSyncStatus(
            false,
            "⚠️ Selecciona primero el destino"
        );

        return;

    }


    autoSyncEnabled =
        true;


    updateAutoSyncStatus(
        true,
        "🟢 Sincronización automática activa"
    );


    autoSyncTimer =
        setInterval(
            checkSourceFileForChanges,
            1500
        );


    showToast(
        "⚡ Sincronización automática activada",
        "success"
    );

}


function stopAutoSync() {

    if (autoSyncTimer) {

        clearInterval(
            autoSyncTimer
        );

        autoSyncTimer =
            null;

    }


    autoSyncEnabled =
        false;


    updateAutoSyncStatus(
        false,
        "⚪ Sin sincronización automática"
    );

}


function updateAutoSyncStatus(
    enabled,
    text
) {

    if (autoSyncStatus) {

        autoSyncStatus.textContent =
            text;

    }


    if (autoSyncCheckbox) {

        autoSyncCheckbox.checked =
            enabled;

    }

}


async function checkSourceFileForChanges() {

    if (
        !autoSyncEnabled
        ||
        !selectedFileHandle
        ||
        !destinationDirectory
        ||
        isSyncing
    ) {

        return;

    }


    try {

        const file =
            await selectedFileHandle.getFile();


        const changed =
            file.lastModified
                !== lastKnownModified
            ||
            file.size
                !== lastKnownSize;


        if (!changed) {
            return;
        }


        isSyncing =
            true;


        updateSyncButton();


        updateAutoSyncStatus(
            true,
            "🟡 Cambio detectado · sincronizando..."
        );


        await writeFileToDestination(
            file,
            file.name
        );


        selectedFile =
            file;

        selectedFiles =
            [file];


        lastKnownModified =
            file.lastModified;

        lastKnownSize =
            file.size;


        renderSelectedFile();

        renderFiles();


        updateAutoSyncStatus(
            true,
            "🟢 Sincronización automática activa"
        );


        addHistory(
            `Actualización automática: ${file.name}`
        );


    } catch (error) {

        console.error(
            "Error en Auto Sync:",
            error
        );


        updateAutoSyncStatus(
            true,
            "🔴 Error al sincronizar"
        );


    } finally {

        isSyncing =
            false;

        updateSyncButton();

    }

}


/* =========================================================
   PROGRESO
   ========================================================= */

function updateProgress(
    current,
    total
) {

    const percent =
        total > 0
            ? Math.round(
                (current / total) * 100
            )
            : 0;


    const progress =
        document.getElementById(
            "progress"
        );


    const progressPercent =
        document.getElementById(
            "progressPercent"
        );


    if (progress) {

        progress.style.width =
            `${percent}%`;

    }


    if (progressPercent) {

        progressPercent.textContent =
            `${percent}%`;

    }

}


/* =========================================================
   HISTORIAL
   ========================================================= */

function getHistory() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "SyncDrivePro_history"
            )
            || "[]"
        );

    } catch {

        return [];

    }

}


function addHistory(message) {

    const history =
        getHistory();


    history.unshift({

        message,

        date:
            new Date().toISOString()

    });


    history.splice(
        30
    );


    localStorage.setItem(
        "SyncDrivePro_history",
        JSON.stringify(history)
    );


    renderHistory();

}


function renderHistory() {

    const historyList =
        document.getElementById(
            "historyList"
        );


    if (!historyList) {
        return;
    }


    const history =
        getHistory();


    if (!history.length) {

        historyList.innerHTML =
            `<div class="empty-history">
                No hay sincronizaciones todavía.
            </div>`;

        return;

    }


    historyList.innerHTML =
        history.map(
            item => {

                const date =
                    new Date(
                        item.date
                    ).toLocaleString();


                return `
                    <div class="history-item">

                        <span class="history-icon">
                            ✓
                        </span>

                        <div>

                            <strong>
                                ${escapeHtml(
                                    item.message
                                )}
                            </strong>

                            <small>
                                ${escapeHtml(
                                    date
                                )}
                            </small>

                        </div>

                    </div>
                `;

            }
        ).join("");

}


/* =========================================================
   PREVISUALIZACIÓN
   ========================================================= */

function previewFileByIndex(index) {

    const file =
        selectedFiles[index];


    if (!file) {
        return;
    }


    const viewerModal =
        document.getElementById(
            "viewerModal"
        );


    const viewerTitle =
        document.getElementById(
            "viewerTitle"
        );


    const viewerType =
        document.getElementById(
            "viewerType"
        );


    const viewerContent =
        document.getElementById(
            "viewerContent"
        );


    if (
        !viewerModal ||
        !viewerContent
    ) {

        return;

    }


    if (viewerTitle) {

        viewerTitle.textContent =
            file.name;

    }


    if (viewerType) {

        viewerType.textContent =
            getFileCategory(file);

    }


    activeObjectUrls.forEach(
        url =>
            URL.revokeObjectURL(
                url
            )
    );


    activeObjectUrls =
        [];


    viewerContent.innerHTML =
        "";


    const url =
        URL.createObjectURL(
            file
        );


    activeObjectUrls.push(
        url
    );


    if (
        file.type.startsWith(
            "image/"
        )
    ) {

        viewerContent.innerHTML =
            `<img
                src="${url}"
                class="viewer-image"
                alt=""
            >`;

    } else if (
        file.type === "application/pdf"
        ||
        file.name
            .toLowerCase()
            .endsWith(".pdf")
    ) {

        viewerContent.innerHTML =
            `<iframe
                src="${url}"
                class="viewer-frame"
                title="PDF"
            ></iframe>`;

    } else if (
        file.type.startsWith(
            "video/"
        )
    ) {

        viewerContent.innerHTML =
            `<video
                src="${url}"
                controls
                class="viewer-video"
            ></video>`;

    } else if (
        file.type.startsWith(
            "audio/"
        )
    ) {

        viewerContent.innerHTML =
            `<audio
                src="${url}"
                controls
                class="viewer-audio"
            ></audio>`;

    } else {

        viewerContent.innerHTML =
            `<div class="viewer-generic">

                <div class="viewer-generic-icon">
                    ${getFileIcon(file)}
                </div>

                <h3>
                    ${escapeHtml(file.name)}
                </h3>

                <p>
                    ${formatBytes(file.size)}
                </p>

                <a
                    href="${url}"
                    download="${escapeHtml(file.name)}"
                >
                    Abrir / descargar archivo
                </a>

            </div>`;

    }


    viewerModal.classList.remove(
        "hidden"
    );

}


/* =========================================================
   EVENTOS
   ========================================================= */

if (selectFileBtn) {

    selectFileBtn.addEventListener(
        "click",
        selectIndividualFile
    );

}


if (changeFileBtn) {

    changeFileBtn.addEventListener(
        "click",
        selectIndividualFile
    );

}


if (selectFolderBtn) {

    selectFolderBtn.addEventListener(
        "click",
        selectFolder
    );

}


if (changeFolderBtn) {

    changeFolderBtn.addEventListener(
        "click",
        selectFolder
    );

}


if (folderInput) {

    folderInput.addEventListener(
        "change",
        handleFolderInput
    );

}


if (selectDestinationBtn) {

    selectDestinationBtn.addEventListener(
        "click",
        selectDestination
    );

}


if (useLastDestinationBtn) {

    useLastDestinationBtn.addEventListener(
        "click",
        useLastDestination
    );

}


if (autoSyncCheckbox) {

    autoSyncCheckbox.addEventListener(
        "change",
        () => {

            if (
                autoSyncCheckbox.checked
            ) {

                startAutoSync();

            } else {

                stopAutoSync();

            }

        }
    );

}


if (syncBtn) {

    syncBtn.addEventListener(
        "click",
        performSync
    );

}


/* =========================================================
   MODO DE SINCRONIZACIÓN
   ========================================================= */

document
    .querySelectorAll(
        'input[name="syncMode"]'
    )
    .forEach(
        radio => {

            radio.addEventListener(
                "change",
                () => {

                    if (radio.checked) {

                        syncMode =
                            radio.value;

                    }


                    document
                        .querySelectorAll(
                            ".sync-modes .mode"
                        )
                        .forEach(
                            mode => {

                                const input =
                                    mode.querySelector(
                                        'input[name="syncMode"]'
                                    );


                                mode.classList.toggle(
                                    "selected",
                                    !!input &&
                                    input.checked
                                );

                            }
                        );

                }
            );

        }
    );


/* =========================================================
   BÚSQUEDA
   ========================================================= */

if (searchInput) {

    searchInput.addEventListener(
        "input",
        () => {

            searchTerm =
                searchInput.value.trim();

            renderFiles();

        }
    );

}


/* =========================================================
   PREVISUALIZACIÓN
   ========================================================= */

if (filesList) {

    filesList.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    ".file-preview-btn"
                );


            if (!button) {
                return;
            }


            const index =
                Number(
                    button.dataset.fileIndex
                );


            previewFileByIndex(
                index
            );

        }
    );

}


/* =========================================================
   FILTROS
   ========================================================= */

document
    .querySelectorAll(
        ".filter[data-filter]"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            ".filter[data-filter]"
                        )
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );


                    button.classList.add(
                        "active"
                    );


                    activeFilter =
                        button.dataset.filter
                        || "all";


                    renderFiles();

                }
            );

        }
    );


/* =========================================================
   CERRAR VISOR
   ========================================================= */

const closeViewerBtn =
    document.getElementById(
        "closeViewerBtn"
    );


if (closeViewerBtn) {

    closeViewerBtn.addEventListener(
        "click",
        () => {

            const viewerModal =
                document.getElementById(
                    "viewerModal"
                );


            if (viewerModal) {

                viewerModal.classList.add(
                    "hidden"
                );

            }

        }
    );

}


/* =========================================================
   LIMPIAR HISTORIAL
   ========================================================= */

const clearHistoryBtn =
    document.getElementById(
        "clearHistoryBtn"
    );


if (clearHistoryBtn) {

    clearHistoryBtn.addEventListener(
        "click",
        () => {

            localStorage.removeItem(
                "SyncDrivePro_history"
            );

            renderHistory();

        }
    );

}


/* =========================================================
   INICIO
   ========================================================= */

async function initSyncDrive() {

    console.log(
        "=============================="
    );

    console.log(
        "       SYNCDRIVE PRO"
    );

    console.log(
        "=============================="
    );


    /*
       Sincronización inicial
       del radio seleccionado.
    */

    const checkedMode =
        document.querySelector(
            'input[name="syncMode"]:checked'
        );


    if (checkedMode) {

        syncMode =
            checkedMode.value;

    }


    await loadLastDestination();

    renderHistory();

    updateSyncButton();


    console.log(
        "[SyncDrive] Sistema cargado."
    );

}


initSyncDrive();


/* =========================================================
   API DEBUG
   ========================================================= */

window.SyncDrivePro = {

    getState() {

        return {

            syncMode,

            selectedSourceType,

            selectedFiles,

            selectedFile,

            selectedFileHandle,

            selectedFolderHandle,

            destinationDirectory,

            autoSyncEnabled,

            isSyncing

        };

    },


    sync() {

        return performSync();

    },


    selectFile() {

        return selectIndividualFile();

    },


    selectFolder() {

        return selectFolder();

    },


    selectDestination() {

        return selectDestination();

    },


    enableAutoSync() {

        startAutoSync();

    },


    disableAutoSync() {

        stopAutoSync();

    }

};
