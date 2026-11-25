// Läuft die Syntax- und Import-Prüfung in einem eigenen Thread, damit Friday währenddessen weiter antwortet (v1.186.0).
import { parentPort, workerData } from "node:worker_threads";
import { pruefeOrdner } from "./testlabor.js";
parentPort.postMessage(pruefeOrdner(workerData.ordner));
