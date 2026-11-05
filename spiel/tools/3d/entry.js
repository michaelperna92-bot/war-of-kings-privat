// 3D-Bibliotheken für War of Kings (4.11.2026): three.js r169 (MIT) + Nachbearbeitung (Bloom) aus den three-Beispielen.
// Gebündelt mit esbuild zu einer Datei (window.WOK_THREE), damit Artefakt und PC-Version ohne Internet laufen.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
window.WOK_THREE = { THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass };
