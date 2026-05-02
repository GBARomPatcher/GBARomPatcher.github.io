# Documentación Completa de Parcheos SRAM y Batería

## Tabla de Contenidos
1. [Introducción](#introducción)
2. [Parcheo SRAM](#parcheo-sram)
3. [Parcheo de Batería](#parcheo-de-batería)
4. [Diferencias Clave](#diferencias-clave)
5. [Flujo Completo](#flujo-completo)

---

## Introducción

El parchador GBA implementa dos tipos de parches complementarios:
- **Parcheo SRAM**: Convierte el almacenamiento Flash/EEPROM a SRAM
- **Parcheo de Batería**: Permite guardar automáticamente en memoria de batería

Ambos trabajan juntos para permitir que cartuchos bootleg guarden datos correctamente.

---

# PARCHEO SRAM

## ¿Qué es el Parcheo SRAM?

El parcheo SRAM redirige todas las operaciones de almacenamiento (Flash/EEPROM) hacia la SRAM interna (32KB) de la GBA. Esto es necesario porque los cartuchos bootleg usan Flash/EEPROM de terceros que el código original no reconoce.

## Estructura de Patrones SRAM

### 1. Componentes Principales

```javascript
// Patrón de Identificación
const IDENT_FLASH1M_V102 = [0x46, 0x4C, 0x41, 0x53, 0x48, 0x31, 0x4D, 0x5F, 0x56, 0x31, 0x30, 0x32, 0x00];
// En ASCII: "FLASH1M_V102\0"

// Patrón de Búsqueda (Marcador)
const FLASH1M_V102_MARKER_1 = [0x05, 0x4b, 0xaa, 0x21, 0x19, 0x70, ...];
// Código original compilado que se busca

// Patrón de Reemplazo
const FLASH1M_V102_REPLACE_1 = [0x05, 0x4B, 0x80, 0x21, 0x09, 0x02, ...];
// Nuevo código que reemplaza al original
```

### 2. Tipos de Flash Soportados

| Tipo | Versiones | Parches | Tamaño |
|------|-----------|---------|--------|
| FLASH1M | V102, V103 | 6-7 | 1MB |
| FLASH512 | - | 5 | 512KB |
| FLASH_V1 | V120, V121 | 3 | Genérico |
| FLASH_V2 | V123, V124 | 4 | Genérico |
| FLASH_V3 | V125, V126 | 4 | Genérico |
| EEPROM | V120, V121, V122, V124, V126 | 2 | 8-64KB |

### 3. Proceso de Identificación

```javascript
getFlashPattern(data) {
    // Itera a través de todos los patrones conocidos
    for (let i = 0; i < this.flashPatterns.length; i++) {
        const flashPattern = this.flashPatterns[i];
        
        // Busca el patrón de identificación (ej: "FLASH1M_V102")
        const position = this.getPosition(data, flashPattern.IdentPattern.Pattern);
        
        if (position !== -1) {
            // ✅ Encontró el tipo de Flash
            console.log('Flash type identified:', flashPattern.FlashType);
            return flashPattern;
        }
    }
    
    // ❌ Tipo desconocido
    console.log('Unknown flash type.');
    return null;
}
```

**Flujo:**
1. Lee la cadena de identificación desde la ROM
2. Compara con cada tipo conocido en `flashPatterns`
3. Retorna la estructura completa cuando encuentra un match

### 4. Sistema de Comodines (Wildcards)

El sistema de búsqueda soporta comodines para mayor flexibilidad:

```javascript
getPosition(data, pattern) {
    for (let i = 0; i <= data.length - pattern.length; i++) {
        let match = true;
        
        for (let j = 0; j < pattern.length; j++) {
            // 0x00 en el patrón = acepta cualquier byte
            if (pattern[j] !== 0x00 && data[i + j] !== pattern[j]) {
                match = false;
                break;
            }
        }
        
        if (match) return i;  // Posición encontrada
    }
    return -1;  // No encontrado
}
```

**Ejemplo:**
```
Patrón:  [0xAA, 0x00, 0x00, 0x55]  ← 0x00 es comodín
ROM:     [0xAA, 0xFF, 0xFF, 0x55]  ← Match ✅

ROM:     [0xAA, 0xFF, 0xFF, 0x56]  ← No Match ❌
```

### 5. Aplicación de Parches

```javascript
applyPatches(data, flashPattern) {
    if (!flashPattern) {
        console.log('Unknown flash type. No patches applied.');
        return data;
    }

    console.log('Applying patches for:', flashPattern.FlashType);
    let patchedData = new Uint8Array(data);

    // Itera a través de cada parche para este tipo de Flash
    for (let i = 0; i < flashPattern.PatchCount; i++) {
        const patch = flashPattern.Patches[i];
        
        // Busca el MARCADOR en los datos
        const position = this.getPosition(patchedData, patch.Marker.Pattern);
        
        if (position !== -1) {
            // Reemplaza el MARCADOR con el REEMPLAZO byte a byte
            for (let j = 0; j < patch.Replace.PatternLength; j++) {
                patchedData[position + j] = patch.Replace.Pattern[j];
            }
            console.log(`Patch ${i + 1} applied at 0x${position.toString(16)}`);
        } else {
            console.log(`ERROR: Patch #${i + 1} marker not found for ${flashPattern.FlashType}`);
        }
    }

    console.log('Patching done.');
    return patchedData;
}
```

**Flujo de Ejemplo (FLASH1M_V102):**
```
Iter 1: Busca MARKER_1 en posición 0x8000 → Reemplaza con REPLACE_1
Iter 2: Busca MARKER_2 en posición 0x8100 → Reemplaza con REPLACE_2
Iter 3: Busca MARKER_3 en posición 0x8200 → Reemplaza con REPLACE_3
...
Iter 6: Busca MARKER_6 en posición 0x8500 → Reemplaza con REPLACE_6
```

### 6. ¿Qué Cambian los Parches?

Los parches modifican instrucciones ARM/Thumb específicas:

```javascript
// Ejemplo: FLASH1M_V102_MARKER_1 vs FLASH1M_V102_REPLACE_1

MARKER (código original para Flash):
[0x05, 0x4b, 0xaa, 0x21, 0x19, 0x70, ...]
 ↓
 Intenta escribir en dirección 0xAA (dirección Flash)

REPLACE (código modificado para SRAM):
[0x05, 0x4B, 0x80, 0x21, 0x09, 0x02, ...]
 ↓
 Escribe en dirección 0x80 (dirección SRAM alternativa)
```

**Cambios clave:**
| Byte | Original | Modificado | Significado |
|------|----------|-----------|-------------|
| 2 | 0xAA | 0x80 | Dirección de escritura |
| 3 | 0x21 | 0x21 | Sin cambio |
| 4-5 | 0x19, 0x70 | 0x09, 0x02 | Lógica de acceso |

### 7. Flujo Completo del Parcheo SRAM

```
Entrada: ROM con Flash desconocido
    ↓
[getFlashPattern] → Identifica tipo (ej: FLASH1M_V102)
    ↓
[applyPatches] → Para cada uno de 6 parches:
    - Busca MARKER_X
    - Reemplaza con REPLACE_X
    ↓
Salida: ROM con SRAM
```

### 8. Ejemplos de Patrones Especiales

#### Bytes Especiales en Flash
```
0xAA (170 dec) → Dirección de comando de Flash
0x55 (85 dec)  → Complemento de 0xAA (0xAA XOR 0xFF)
0xFF (255 dec) → Valor por defecto (no programado)
0x00 (0 dec)   → Wildcard en búsqueda
```

#### Estructura de Datos
```javascript
this.flashPatterns = [
    {
        // Patrón para identificar este tipo de Flash
        IdentPattern: {
            Pattern: [0x46, 0x4C, ...],  // "FLASH1M_V102"
            PatternLength: 13
        },
        // Array de parches a aplicar
        Patches: [
            {
                Marker: {
                    Pattern: [0x05, 0x4b, ...],
                    PatternLength: 24
                },
                Replace: {
                    Pattern: [0x05, 0x4B, ...],
                    PatternLength: 24
                }
            },
            // ... más parches ...
        ],
        PatchCount: 6,
        FlashType: 'FLASH1M_V102'
    }
]
```

---

# PARCHEO DE BATERÍA

## ¿Qué es el Parcheo de Batería?

El parcheo de batería inyecta código adicional (payload) en la ROM que:
1. Intercepta llamadas a funciones de guardado
2. Redirige datos a memoria de batería
3. Gestiona la sincronización automática (modo Auto) o manual (modo Keypad)

## Pasos del Parcheo de Batería

### 1. Validación Inicial

```javascript
async applyBatteryPatches(romData, batteryMode) {
    let romSize = romData.length;
    let dataView = new DataView(romData.buffer);

    const MAX_ROM_SIZE = 0x02000000;  // 32MB
    if (romSize > MAX_ROM_SIZE) {
        throw new Error(`ROM too large (${romSize} bytes)`);
    }

    const ALIGNMENT = 0x40000;  // 256KB
    if (romSize % ALIGNMENT !== 0) {
        // Alinea a 256KB
        const originalSize = romSize;
        romSize = (Math.floor(romSize / ALIGNMENT) + 1) * ALIGNMENT;
        
        const paddedRomData = new Uint8Array(romSize).fill(0xFF);
        paddedRomData.set(romData.slice(0, originalSize));
        romData = paddedRomData;
        dataView = new DataView(romData.buffer);
        
        this.logMessage('ROM padded to 256KB alignment');
    }

    // Verifica si ya está parchada
    if (this.findBytes(romData, this.signature, 4) !== -1) {
        throw new Error('ROM already patched!');
    }
}
```

**Alineación:**
- Las ROMs deben ser múltiplos de 256KB (0x40000)
- Si no, se rellena con 0xFF hasta el próximo múltiplo
- Ejemplo: 32MB + 1 byte → se expande a 32MB + 256KB

### 2. Parcheo de IRQ Handler

```javascript
// Patch references to IRQ handler address
const oldIrqAddr = new Uint8Array([0xfc, 0x7f, 0x00, 0x03]);
const newIrqAddr = new Uint8Array([0xf4, 0x7f, 0x00, 0x03]);
let foundIrq = 0;

for (let i = 0; i <= romSize - oldIrqAddr.length; i += 4) {
    if (this.findBytes(romData.slice(i, i + oldIrqAddr.length), oldIrqAddr, 1) === 0) {
        foundIrq++;
        this.logMessage(`Found IRQ handler at 0x${i.toString(16)}, patching`);
        romData.set(newIrqAddr, i);
    }
}
```

**¿Por qué?**
- El IRQ (Interrupt Request) handler maneja interrupciones
- Se necesita redirigir para intercalar el payload
- Cambio: `0xfc7f0003` → `0xf47f0003` (desplaza dirección de datos)

### 3. Búsqueda de Espacio para el Payload

```javascript
let payloadBase = -1;
const calculationPayloadLen = 2160;  // Tamaño del payload

// Busca desde el final hacia atrás, en incrementos de 256KB
for (let i = romSize - ALIGNMENT - calculationPayloadLen; i >= 0; i -= ALIGNMENT) {
    let isAllZeroes = true;
    let isAllOnes = true;
    
    // Verifica si la ubicación está disponible (todos 0x00 o 0xFF)
    for (let j = 0; j < ALIGNMENT + calculationPayloadLen; ++j) {
        if (i + j >= romSize) break;
        
        if (romData[i + j] !== 0) isAllZeroes = false;
        if (romData[i + j] !== 0xFF) isAllOnes = false;
    }
    
    if (isAllZeroes || isAllOnes) {
        payloadBase = i;
        break;
    }
}
```

**Criterios:**
- Busca sector **completamente vacío** (todos 0x00 o todos 0xFF)
- Debe estar alineado a 256KB
- Debe haber espacio para 2160 bytes de payload

**Si no encuentra espacio:**
```javascript
if (payloadBase < 0) {
    if (romSize + ALIGNMENT * 2 > MAX_ROM_SIZE) {
        throw new Error("ROM max size, cannot expand");
    } else {
        // Expande ROM en 512KB (2 × 256KB)
        const expandedRomData = new Uint8Array(romSize + ALIGNMENT * 2).fill(0xFF);
        expandedRomData.set(romData);
        romData = expandedRomData;
        romSize = romData.length;
        payloadBase = romSize - ALIGNMENT - calculationPayloadLen;
    }
}
```

### 4. Inyección del Payload

```javascript
this.logMessage(`Installing payload at offset 0x${payloadBase.toString(16)}`);

// Inyecta solo los primeros 2160 bytes del payload
romData.set(this.embeddedPayloadBin.slice(0, calculationPayloadLen), payloadBase);
```

**El payload es código ARM compilado que:**
- Gestiona escrituras de datos
- Maneja modo auto vs. keypad
- Sincroniza batería
- Valida integridad de datos

### 5. Parcheo del Punto de Entrada (Entrypoint)

```javascript
// Lee la instrucción original en la dirección 0 (punto de entrada)
const originalEntrypointInstruction = this.readUint32(dataView, 0);

// Extrae el offset (los 24 bits inferiores, desplazados 2 bits)
const originalEntrypointOffset = (originalEntrypointInstruction & 0x00FFFFFF) << 2;

// Calcula la dirección absoluta (0x08000000 es base de código de GBA)
const originalEntrypointAddress = 0x08000000 + 8 + originalEntrypointOffset;

this.logMessage(`Original entrypoint: 0x${originalEntrypointAddress.toString(16)}`);

// Guarda la dirección original en el payload
this.writeUint32(dataView, payloadBase + this.PAYLOAD_OFFSETS.ORIGINAL_ENTRYPOINT_ADDR, 
                 originalEntrypointAddress);
```

**¿Qué es el Entrypoint?**
- Primera instrucción que ejecuta la GBA
- Típicamente es un salto (branch) a `main()`
- Necesitamos guardar el original para que el payload pueda saltar después

### 6. Configuración del Modo Flush

```javascript
// 0 = Auto (guarda después de cada escritura)
// 1 = Keypad (requiere combinación de botones para guardar)
const flushMode = batteryMode === 'auto' ? 0 : 1;

this.writeUint32(dataView, 
                 payloadBase + this.PAYLOAD_OFFSETS.FLUSH_MODE, 
                 flushMode);

this.logMessage(`Selected mode: ${flushMode === 0 ? 'Auto' : 'Keypad'}`);
```

### 7. Parcheo del Nuevo Punto de Entrada

```javascript
// Calcula la dirección del nuevo entrypoint (dentro del payload)
const newEntrypointAddress = 0x08000000 + payloadBase + 
    this.readUint32(new DataView(this.embeddedPayloadBin.buffer), 
                    this.PAYLOAD_OFFSETS.PATCHED_ENTRYPOINT);

// Calcula el offset para la instrucción ARM branch
// PC + 8 es donde apunta el PC durante la ejecución de la instrucción
const newEntrypointOffset = (newEntrypointAddress - 0x08000008) >> 2;

// Escribe nueva instrucción ARM: 0xEA000000 | offset
// 0xEA = opcode para branch incondicionado
this.writeUint32(dataView, 0, 0xea000000 | newEntrypointOffset);

this.logMessage(`New entrypoint: 0x${newEntrypointAddress.toString(16)}`);
```

**Instrucción ARM Branch:**
```
0xEA000000 | offset
├─ 0xEA ────────── Opcode para "branch" incondicionado
└─ offset ──────── Cuánto saltar (en palabras de 32 bits)
```

### 8. Búsqueda y Parcheo de Funciones de Guardado

```javascript
let foundWriteLocation = false;

// Itera cada 2 bytes (tamaño de instrucción Thumb)
for (let i = 0; i <= romSize - 64; i += 2) {
    let signatureMatch = -1;
    let patchType = null;
    let saveSize = 0;

    // Busca diferentes tipos de funciones de guardado
    if ((signatureMatch = this.findBytes(romData.slice(i, ...), this.writeSramSignature, 1)) === 0) {
        patchType = 'thumb';
        saveSize = 0x8000;  // 32KB SRAM
        payloadHookOffset = this.PAYLOAD_OFFSETS.WRITE_SRAM_PATCHED;
        
    } else if ((signatureMatch = this.findBytes(romData.slice(i, ...), this.writeFlashSignature, 1)) === 0) {
        patchType = 'thumb';
        saveSize = 0x10000;  // 64KB Flash
        payloadHookOffset = this.PAYLOAD_OFFSETS.WRITE_FLASH_PATCHED;
        
    } else if ((signatureMatch = this.findBytes(romData.slice(i, ...), this.writeEepromSignature, 1)) === 0) {
        patchType = 'thumb';
        saveSize = 0x2000;   // 8KB EEPROM
        payloadHookOffset = this.PAYLOAD_OFFSETS.WRITE_EEPROM_PATCHED;
    }
    // ... más tipos ...

    if (patchType !== null) {
        foundWriteLocation = true;
        
        // Guarda el tamaño del almacenamiento en el payload
        this.writeUint32(dataView, 
                        payloadBase + this.PAYLOAD_OFFSETS.SAVE_SIZE, 
                        saveSize);
    }
}
```

**Tipos de Funciones Detectadas:**
| Firma | Tipo | Tamaño | Modo |
|-------|------|--------|------|
| WriteSram | Thumb | 32KB | SRAM parchado |
| WriteSram2 | Thumb | 32KB | Variante SRAM |
| WriteFlash | Thumb | 64KB | Flash parchado |
| WriteEEPROM | Thumb | 8KB | EEPROM parchado |
| WriteEEPROM_V111 | Thumb epilogue | 8KB | Post-hook |

### 9. Instalación de Thunks (Solo en Modo Auto)

```javascript
if (flushMode === 0) {  // Solo en modo Auto
    if (patchType === 'thumb') {
        // Reemplaza la función original con un "thunk" (trampolín)
        romData.set(this.thumbBranchThunk, i + patchOffset);
        
        // Calcula dirección a la que saltar dentro del payload
        const jumpAddress = 0x08000000 + payloadBase + 
            this.readUint32(new DataView(this.embeddedPayloadBin.buffer), 
                          payloadHookOffset);
        
        // Escribe la dirección objetivo después del thunk
        this.writeUint32(dataView, 
                        i + patchOffset + this.thumbBranchThunk.length, 
                        jumpAddress);
        
        this.logMessage(`Patched Thumb at 0x${i.toString(16)} → 0x${jumpAddress.toString(16)}`);
        
    } else if (patchType === 'arm') {
        // Similar pero para instrucciones ARM
        romData.set(this.armBranchThunk, i + patchOffset);
        const jumpAddress = 0x08000000 + payloadBase + ...;
        this.writeUint32(dataView, i + patchOffset + this.armBranchThunk.length, jumpAddress);
    }
}
```

**¿Qué es un Thunk?**
Un thunk es un pequeño trozo de código que salta a otra ubicación:
```asm
; Thunk original:
PUSH {PC}
BX LR

; Se reemplaza con:
PUSH {PC}
B <PAYLOAD_ADDRESS>

; El payload se ejecuta y luego retorna
```

---

# DIFERENCIAS CLAVE

## Parcheo SRAM vs. Parcheo de Batería

| Aspecto | SRAM | Batería |
|---------|------|---------|
| **Objetivo** | Redireccionar Flash→SRAM | Guardar SRAM→Batería |
| **Método** | Reemplazo de bytes | Inyección de payload |
| **Cantidad de Cambios** | 2-7 por tipo | 1 entrypoint + múltiples hooks |
| **Tamaño de Cambios** | 8-96 bytes por parche | 2160 bytes de payload |
| **Riesgo** | Bajo (cambios simples) | Medio (inyecta código) |
| **Reversibilidad** | Difícil (muy especializado) | Posible (payload aislado) |
| **Dependencias** | Ninguna | Requiere SRAM parchada primero |
| **Modo Manual** | N/A | Keypad (combinación botones) |
| **Modo Automático** | N/A | Auto (cada escritura) |

## Complementariedad

```
Bootleg Flash/EEPROM
        ↓
[PARCHEO SRAM]
Convierte a SRAM (32KB)
        ↓
[PARCHEO BATERÍA]
Guarda SRAM a Batería
        ↓
Guardado Persistente ✅
```

---

# FLUJO COMPLETO

## Secuencia de Operaciones

```
Usuario selecciona ROM
    ↓
PASO 1: VALIDACIÓN
├─ Verifica que sea .gba
├─ Verifica tamaño ≤ 32MB
└─ Habilita botón de parcheo

    ↓
PASO 2: PARCHEO SRAM (si está habilitado)
├─ getFlashPattern()       → Identifica tipo de Flash
├─ applyPatches()          → Aplica 2-7 parches
└─ Registra resultado

    ↓
PASO 3: PARCHEO BATERÍA (si está habilitado)
├─ Alinea ROM a 256KB
├─ Verifica no está parchada
├─ Parcha IRQ handler
├─ Encuentra espacio para payload
├─ Inyecta payload (2160 bytes)
├─ Parcha entrypoint → payload
├─ Busca funciones de guardado
├─ Inyecta thunks (si modo Auto)
└─ Registra cada paso

    ↓
PASO 4: GENERACIÓN DE DESCARGA
├─ Crea blob con datos parchados
├─ Genera nombre de archivo (ej: game_ultimate_auto.gba)
├─ Prepara link de descarga
└─ Muestra resultado

    ↓
Usuario descarga ROM parchada ✅
```

## Nombres de Archivo Generados

```javascript
const sramEnabled = this.elements.enableSramPatching.checked;
const batteryEnabled = this.elements.enableBatteryPatching.checked;

if (sramEnabled && batteryEnabled) {
    const batteryMode = document.querySelector('input[name="batteryMode"]:checked').value;
    suffix = batteryMode === 'auto' ? '_ultimate_auto.gba' : '_ultimate_keypad.gba';
    // Ejemplo: game_ultimate_auto.gba
    
} else if (sramEnabled) {
    suffix = '_sram_only.gba';
    // Ejemplo: game_sram_only.gba
    
} else if (batteryEnabled) {
    const batteryMode = document.querySelector('input[name="batteryMode"]:checked').value;
    suffix = batteryMode === 'auto' ? '_battery_auto.gba' : '_battery_keypad.gba';
    // Ejemplo: game_battery_auto.gba
    
} else {
    suffix = '_no_patches.gba';
    // Ejemplo: game_no_patches.gba (básicamente una copia)
}
```

---

## Configuración de Offsets del Payload

El payload inyectado tiene varios offsets configurables:

```javascript
this.PAYLOAD_OFFSETS = {
    ORIGINAL_ENTRYPOINT_ADDR: 0x000,  // Dirección original del entrypoint
    PATCHED_ENTRYPOINT: 0x004,        // Offset al nuevo entrypoint dentro del payload
    FLUSH_MODE: 0x008,                // 0=Auto, 1=Keypad
    SAVE_SIZE: 0x00C,                 // Tamaño del guardado (32KB, 64KB, etc.)
    WRITE_SRAM_PATCHED: 0x010,        // Offset para hook de WriteSram
    WRITE_EEPROM_PATCHED: 0x014,      // Offset para hook de WriteEeprom
    WRITE_FLASH_PATCHED: 0x018,       // Offset para hook de WriteFlash
    WRITE_EEPROM_V111_POSTHOOK: 0x01C // Offset para post-hook de EEPROM v1.11
};
```

Estos offsets se llenan dinámicamente:
1. Se inyecta el payload base
2. Se escribe el entrypoint original guardado
3. Se escribe el modo seleccionado (Auto/Keypad)
4. Se escribe el tamaño del almacenamiento detectado
5. Los thunks apuntan a estos offsets

---

## Manejo de Errores

### SRAM
```
❌ No se detecta Flash → "ROM may already use SRAM"
```

### Batería
```
❌ ROM > 32MB → "ROM too large"
❌ ROM ya parchada → "ROM already patched!"
❌ IRQ no encontrado → "Has the ROM already been patched?"
❌ No hay espacio, ROM = 32MB → "Cannot install payload"
❌ No encuentra función de guardado (Auto) → "Could not find a write function"
```

---

## Resumen Técnico

### Parcheo SRAM
- **Método**: Búsqueda y reemplazo de bytes
- **Elementos**: Identificación + Marcadores + Reemplazos
- **Complejidad**: Media
- **Reversibilidad**: Difícil

### Parcheo Batería
- **Método**: Inyección de código + Redirección de funciones
- **Elementos**: Payload + Thunks + Hooks
- **Complejidad**: Alta
- **Reversibilidad**: Posible

### Combinado
- **Sinergia**: Batería depende de SRAM
- **Flujo**: SRAM → Batería
- **Resultado**: Guardado persistente en bootleg
- **Compatibilidad**: Requiere GBA con batería
