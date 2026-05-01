// This entire script handles the "IPS/BPS Patcher" tab and tab-switching logic.
// It does not interfere with the original script.js.
document.addEventListener('DOMContentLoaded', () => {

    // --- Tab Switching Logic ---
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // --- FIX: Define all elements that need to be reset ---
    const elementsToReset = [
        document.getElementById('progressSection'), // Original tab progress
        document.getElementById('downloadSection'), // Original tab download
        document.getElementById('ipsProgressSection'), // New tab progress
        document.getElementById('ipsDownloadWrapper')  // New tab download
    ];

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Deactivate all buttons and content
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Activate the clicked button and its corresponding content
            button.classList.add('active');
            document.getElementById(button.dataset.tab).classList.add('active');

            // --- FIX: Reset UI state for all tabs on every switch ---
            elementsToReset.forEach(element => {
                if (element) {
                    element.classList.add('hidden');
                }
            });
        });
    });

    // --- IPS/BPS Patcher Logic ---
    const ipsPatcher = {
        romDropZone: document.getElementById('ipsRomDropZone'),
        romFileInput: document.getElementById('ipsRomFile'),
        romFileInfo: document.getElementById('ipsRomFileInfo'),
        patchDropZone: document.getElementById('ipsPatchDropZone'),
        patchFileInput: document.getElementById('ipsPatchFile'),
        patchFileInfo: document.getElementById('ipsPatchFileInfo'),
        patchButton: document.getElementById('ipsPatchButton'),
        progressSection: document.getElementById('ipsProgressSection'),
        progressSteps: document.getElementById('ipsProgressSteps'),
        downloadWrapper: document.getElementById('ipsDownloadWrapper'),
        downloadLink: document.getElementById('ipsDownloadLink'),
        romBuffer: null,
        patchBuffer: null,
        romFileName: 'game_patched.gba'
    };

    // --- Helper Functions for IPS Patcher ---
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const readFileAsArrayBuffer = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.onerror = (e) => reject(e);
        reader.readAsArrayBuffer(file);
    });
    const showIpsFileInfo = (element, message, type) => {
        element.textContent = message;
        element.className = `file-info ${type === 'error' ? 'error' : 'success'} show`;
    };
     const addIpsProgressStep = (text, status) => {
        const step = document.createElement('div');
        step.className = `progress-step ${status}`;
        const icon = status === 'completed' ? '✅' : (status === 'active' ? '⏳' : '❌');
        step.innerHTML = `<span class="step-icon">${icon}</span> <span class="step-text">${text}</span>`;
        ipsPatcher.progressSteps.appendChild(step);
        return step;
    };
    const updateIpsProgressStep = (element, text, status) => {
        element.className = `progress-step ${status}`;
        const icon = status === 'completed' ? '✅' : (status === 'active' ? '⏳' : '❌');
        element.innerHTML = `<span class="step-icon">${icon}</span> <span class="step-text">${text}</span>`;
    };

    // --- Main Logic for the IPS/BPS Patcher Tab ---
    const checkIpsButtonState = () => {
        ipsPatcher.patchButton.disabled = !(ipsPatcher.romBuffer && ipsPatcher.patchBuffer);
    };
    
    const handleIpsRomFile = async (file) => {
        // Reset UI when a new file is uploaded
        ipsPatcher.progressSection.classList.add('hidden');
        ipsPatcher.downloadWrapper.classList.add('hidden');

        if (!file) { 
            ipsPatcher.romBuffer = null;
            ipsPatcher.romFileInfo.classList.remove('show');
        } 
        else {
            try {
                ipsPatcher.romFileName = file.name.replace(/\.(gba|gbc|gb)$/i, '_patched' + file.name.match(/\.(gba|gbc|gb)$/i)[0]);
                ipsPatcher.romBuffer = await readFileAsArrayBuffer(file);
                showIpsFileInfo(ipsPatcher.romFileInfo, `Selected ROM: ${file.name}`, 'success');
            } catch (e) {
                showIpsFileInfo(ipsPatcher.romFileInfo, `Error reading file: ${e.message}`, 'error');
                ipsPatcher.romBuffer = null;
            }
        }
        checkIpsButtonState();
    };

    const handleIpsPatchFile = async (file) => {
        // Reset UI when a new file is uploaded
        ipsPatcher.progressSection.classList.add('hidden');
        ipsPatcher.downloadWrapper.classList.add('hidden');

        if (!file) { 
            ipsPatcher.patchBuffer = null;
            ipsPatcher.patchFileInfo.classList.remove('show');
        } 
        else {
            const valid = ['.ips', '.bps', '.ups'].some(ext => file.name.toLowerCase().endsWith(ext));
            if (!valid) {
                showIpsFileInfo(ipsPatcher.patchFileInfo, 'Error: Use .ips or .bps file.', 'error');
                ipsPatcher.patchBuffer = null;
            } else {
                 try {
                    ipsPatcher.patchBuffer = await readFileAsArrayBuffer(file);
                    showIpsFileInfo(ipsPatcher.patchFileInfo, `Selected Patch: ${file.name}`, 'success');
                } catch (e) {
                    showIpsFileInfo(ipsPatcher.patchFileInfo, `Error reading patch file: ${e.message}`, 'error');
                    ipsPatcher.patchBuffer = null;
                }
            }
        }
        checkIpsButtonState();
    };

    ipsPatcher.romDropZone.addEventListener('dragover', e => e.preventDefault());
    ipsPatcher.romDropZone.addEventListener('drop', e => { e.preventDefault(); handleIpsRomFile(e.dataTransfer.files[0]); });
    ipsPatcher.romFileInput.addEventListener('change', () => handleIpsRomFile(ipsPatcher.romFileInput.files[0]));

    ipsPatcher.patchDropZone.addEventListener('dragover', e => e.preventDefault());
    ipsPatcher.patchDropZone.addEventListener('drop', e => { e.preventDefault(); handleIpsPatchFile(e.dataTransfer.files[0]); });
    ipsPatcher.patchFileInput.addEventListener('change', () => handleIpsPatchFile(ipsPatcher.patchFileInput.files[0]));
    
    ipsPatcher.patchButton.addEventListener('click', async () => {
        if (!ipsPatcher.romBuffer || !ipsPatcher.patchBuffer) return;

        ipsPatcher.progressSection.classList.remove('hidden');
        ipsPatcher.downloadWrapper.classList.add('hidden');
        ipsPatcher.progressSteps.innerHTML = '';
        let currentStep = addIpsProgressStep('Applying game patch...', 'active');

        try {
            await sleep(50); 
            const patchExt = ipsPatcher.patchFileInput.files[0].name.toLowerCase().split('.').pop();
            let patchedRom;
            if (patchExt === 'ips') patchedRom = applyIps(ipsPatcher.romBuffer, ipsPatcher.patchBuffer);
            else if (patchExt === 'bps') patchedRom = applyBps(ipsPatcher.romBuffer, ipsPatcher.patchBuffer);
            else throw new Error('Unsupported patch format.');
            
            updateIpsProgressStep(currentStep, 'Game patch applied successfully!', 'completed');
            
            await sleep(250); 
            
            const blob = new Blob([patchedRom], { type: 'application/octet-stream' });
            ipsPatcher.downloadLink.href = URL.createObjectURL(blob);
            ipsPatcher.downloadLink.download = ipsPatcher.romFileName;
            
            ipsPatcher.progressSection.classList.add('hidden');
            ipsPatcher.downloadWrapper.classList.remove('hidden');

        } catch(e) {
            updateIpsProgressStep(currentStep, `Error: ${e.message}`, 'error');
        }
    });

    // --- Patcher Algorithm Implementations ---
    const applyIps = (rom, patch) => {
         if (patch[0]!==0x50||patch[1]!==0x41||patch[2]!==0x54||patch[3]!==0x43||patch[4]!==0x48) throw new Error("Invalid IPS: Missing 'PATCH' header.");
         const newRom = new Uint8Array(rom); let offset = 5;
         while(offset < patch.length - 3) {
             let recOff = (patch[offset]<<16)|(patch[offset+1]<<8)|patch[offset+2];
             if (recOff === 0x454F46) return newRom;
             offset += 3; let recSize = (patch[offset]<<8)|patch[offset+1]; offset += 2;
             if (recSize > 0) {
                 for(let i=0;i<recSize;i++) if(recOff+i<newRom.length) newRom[recOff+i] = patch[offset+i];
                 offset += recSize;
             } else {
                 const rleSize = (patch[offset]<<8)|patch[offset+1]; offset += 2;
                 const rleByte = patch[offset++];
                 for (let i=0;i<rleSize;i++) if(recOff+i<newRom.length) newRom[recOff+i] = rleByte;
             }
         }
         return newRom;
    };
    const applyBps = (rom, patch) => {
        const readVlv=o=>{let r=0,s=1;while(1){const x=patch[o.o++];r+=(x&0x7F)*s;if(x&0x80)break;s<<=7;r+=s}return r};
        if(patch[0]!==0x42||patch[1]!==0x50||patch[2]!==0x53||patch[3]!==0x31)throw new Error("Invalid BPS: Missing 'BPS1' header.");
        const o={o:4};readVlv(o);const tS=readVlv(o);const mS=readVlv(o);o.o+=mS;
        const out=new Uint8Array(tS);let outO=0,sR=0,tR=0;
        while(o.o<patch.length-12){
            const d=readVlv(o),c=d&3,l=(d>>2)+1;
            if(c===0){for(let i=0;i<l;i++)out[outO+i]=rom[outO+i];outO+=l}
            else if(c===1){for(let i=0;i<l;i++)out[outO+i]=patch[o.o+i];o.o+=l;outO+=l}
            else{const v=readVlv(o),rO=(v&1?-1:1)*(v>>1);if(c===2){sR+=rO;for(let i=0;i<l;i++)out[outO+i]=rom[sR+i];sR+=l;outO+=l}else{tR+=rO;for(let i=0;i<l;i++)out[outO+i]=out[tR+i];tR+=l;outO+=l}}
        }return out;
    };
});
