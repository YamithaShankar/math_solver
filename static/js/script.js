document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    const pencilBtn = document.getElementById('pencilBtn');
    const eraserBtn = document.getElementById('eraserBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const clearBtn = document.getElementById('clearBtn');
    const solveBtn = document.getElementById('solveBtn');
    const solutionOutput = document.getElementById('solutionOutput');
    const loadingSpinner = document.getElementById('loadingSpinner');

    let drawing = false;
    let eraserMode = false;
    let history = [];
    let historyIndex = -1;

    // Set initial canvas properties
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000'; // Default pencil color

    // Function to save current state for undo/redo
    function saveState() {
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        history.push(canvas.toDataURL());
        historyIndex = history.length - 1;
    }

    // Function to restore state
    function restoreState() {
        if (historyIndex >= 0 && history[historyIndex]) {
            const img = new Image();
            img.src = history[historyIndex];
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
            };
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear if no history
        }
    }

    // Initial save for an empty canvas
    saveState();

    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    function getTouchPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    }

    // Event Listeners for Drawing
    canvas.addEventListener('mousedown', (e) => {
        drawing = true;
        const pos = getMousePos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!drawing) return;
        const pos = getMousePos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    });

    canvas.addEventListener('mouseup', () => {
        if (drawing) {
            drawing = false;
            ctx.closePath();
            saveState(); // Save state after each stroke
        }
    });

    canvas.addEventListener('mouseout', () => {
        if (drawing) {
            drawing = false;
            ctx.closePath();
            saveState();
        }
    });

    // Touch events for mobile devices
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling
        drawing = true;
        const pos = getTouchPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Prevent scrolling
        if (!drawing) return;
        const pos = getTouchPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    });

    canvas.addEventListener('touchend', () => {
        if (drawing) {
            drawing = false;
            ctx.closePath();
            saveState();
        }
    });

    // Control Buttons Functionality
    pencilBtn.addEventListener('click', () => {
        eraserMode = false;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        pencilBtn.classList.add('active');
        eraserBtn.classList.remove('active');
    });

    eraserBtn.addEventListener('click', () => {
        eraserMode = true;
        ctx.strokeStyle = '#f9f9f9'; // Match canvas background for erasing effect
        ctx.lineWidth = 15; // Thicker for easier erasing
        eraserBtn.classList.add('active');
        pencilBtn.classList.remove('active');
    });

    undoBtn.addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            restoreState();
        }
    });

    redoBtn.addEventListener('click', () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            restoreState();
        }
    });

    clearBtn.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        history = []; // Clear history
        historyIndex = -1;
        saveState(); // Save empty state
        solutionOutput.innerHTML = ''; // Clear previous solution
    });


    solveBtn.addEventListener('click', async () => {
        solutionOutput.innerHTML = ''; // Clear previous solution
        loadingSpinner.style.display = 'block'; // Show loading spinner
        solveBtn.disabled = true; // Disable solve button during loading

        try {
            // --- CRITICAL FIX: Draw current history state onto an offscreen canvas with white background ---
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = canvas.width;
            offscreenCanvas.height = canvas.height;
            const offscreenCtx = offscreenCanvas.getContext('2d');

            // 1. Fill the offscreen canvas with a white background
            offscreenCtx.fillStyle = '#FFFFFF';
            offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

            // 2. Load the current image from history onto the offscreen canvas
            //    This is the key change to ensure the drawing is present.
            if (historyIndex >= 0 && history[historyIndex]) {
                const img = new Image();
                img.src = history[historyIndex];

                // Use a Promise to ensure the image is loaded before drawing and toBlob
                await new Promise((resolve, reject) => {
                    img.onload = () => {
                        offscreenCtx.drawImage(img, 0, 0);
                        resolve();
                    };
                    img.onerror = reject;
                });
            }
            // --- END CRITICAL FIX ---


            // Convert offscreen canvas content to a PNG image Blob
            // This part now operates on the offscreenCanvas which holds the drawing on white.
            offscreenCanvas.toBlob(async (blob) => {
                if (!blob || blob.size === 0) {
                    console.error('Error: offscreenCanvas.toBlob returned null, undefined, or empty blob. Is anything drawn?');
                    solutionOutput.innerHTML = '<p class="error-message">Error: Could not capture canvas image. Make sure you\'ve drawn something visible.</p>';
                    loadingSpinner.style.display = 'none';
                    solveBtn.disabled = false;
                    return;
                }
                console.log('Blob size from offscreenCanvas:', blob.size, 'bytes'); // Log for debugging

                const formData = new FormData();
                formData.append('image', blob, 'equation.png');

                const response = await fetch('/solve_equation', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.solution) {
                        solutionOutput.innerHTML = data.solution;
                        if (typeof MathJax !== 'undefined') {
                            MathJax.typesetPromise([solutionOutput]).then(() => {
                                console.log('MathJax typeset complete');
                            }).catch((err) => console.error('MathJax typeset error:', err));
                        }
                    } else if (data.error) {
                        solutionOutput.innerHTML = `<p class="error-message">Error: ${data.error}</p>`;
                    }
                } else {
                    const errorData = await response.json();
                    solutionOutput.innerHTML = `<p class="error-message">Server Error: ${errorData.error || response.statusText}</p>`;
                }
            }, 'image/png');

        } catch (error) {
            console.error('An unexpected error occurred while fetching the solution:', error);
            solutionOutput.innerHTML = `<p class="error-message">An unexpected error occurred: ${error.message}</p>`;
        } finally {
            loadingSpinner.style.display = 'none';
            solveBtn.disabled = false;
        }
    });
});
