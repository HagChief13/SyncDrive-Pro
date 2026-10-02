document.addEventListener("DOMContentLoaded", () => {

    console.log("================================");
    console.log("TEST 12 — DESTINO + INTERFAZ");
    console.log("================================");

    const button =
        document.getElementById("selectDestinationBtn");

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

    console.log("button:", button);
    console.log("destinationName:", destinationName);
    console.log("destinationType:", destinationType);

    button.addEventListener("click", async () => {

        console.log("🟡 CLICK");

        try {

            const handle =
                await window.showDirectoryPicker();

            console.log("🟢 CARPETA SELECCIONADA");
            console.log("Nombre:", handle.name);

            // ==========================================
            // ESCRIBIR DIRECTAMENTE EN LA INTERFAZ
            // ==========================================

            destinationName.textContent =
                handle.name;

            destinationType.textContent =
                "Carpeta de destino";

            destinationStatus.textContent =
                "LISTO";

            destinationStatusText.textContent =
                "Lista para escribir";

            destinationCheck.style.display =
                "grid";

            destinationCheck.textContent =
                "✓";

            console.log(
                "🟢 INTERFAZ ACTUALIZADA"
            );

        } catch (error) {

            console.error(
                "🔴 ERROR:",
                error
            );

        }

    });

});