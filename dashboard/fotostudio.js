// F.R.Ai.D.A.Y Foto-Studio (v1.175.0): die Technik, mit der Autos im Auto-Studio und in der Werkstatt
// wie fotografiert aussehen statt wie Spielzeug.
//
// 1. Echtes Studio-Licht: eine HDR-Aufnahme eines Fotostudios (Poly Haven, CC0) plus Friday-Softboxen
//    für die langen Lichtkanten im Lack. Liegt als vendor/studio.hdr bei (512 × 256, ~0,5 MB).
// 2. Kontaktschatten: das Auto wird von unten "fotografiert", das Bild weichgezeichnet und als Schatten
//    unter das Auto gelegt – dunkel, wo die Reifen aufsetzen, weich nach außen (wie im echten Studio).
// 3. Weiche Spiegelung: der Spiegelboden zeigt das Auto nur noch zart und blendet nach unten aus.
// 4. Echter Lack für fertige 3D-Modelle: Lackteile werden erkannt, bekommen Klarlack und lassen sich umfärben.
//
// window.FridayFoto = { umgebung(renderer, softboxen), kontaktSchatten(renderer), spiegelMaterial(auto, farbe),
//                       lackTeile(obj), lackFaerben(teile, hex), modellAufbereiten(obj) }
(() => {
  "use strict";
  const THREE = window.THREE;
  if (!THREE) return;

  // ---------- 1. Studio-Licht ----------
  let hdrDaten = null; // Promise<DataTexture|null>, einmal pro Seite
  function ladeHdr() {
    if (hdrDaten) return hdrDaten;
    hdrDaten = new Promise((ok) => {
      if (!THREE.RGBELoader) return ok(null);
      const l = new THREE.RGBELoader();
      if (l.setDataType) l.setDataType(THREE.UnsignedByteType);
      l.load("vendor/studio.hdr", (tex) => ok(tex), undefined, () => ok(null));
    });
    return hdrDaten;
  }

  // Studio-Raum mit Softboxen; mit HDR-Aufnahme als Kugel drumherum (echte Details in den Spiegelungen).
  function softboxSzene(hdr, hell) {
    const env = new THREE.Scene();
    if (hdr) {
      const kugel = new THREE.Mesh(new THREE.SphereGeometry(30, 64, 32), new THREE.MeshBasicMaterial({ map: hdr, side: THREE.BackSide, toneMapped: false }));
      kugel.material.color.setScalar(hell ? 0.55 : 0.35);
      env.add(kugel);
    } else {
      const raum = new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24), new THREE.MeshBasicMaterial({ color: hell ? 0x55595f : 0x2b3038, side: THREE.BackSide }));
      raum.position.y = 5; env.add(raum);
    }
    const flaeche = (w, h, pos, rot, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(...pos); m.rotation.set(...rot); env.add(m);
    };
    flaeche(24, 24, [0, -0.9, 0], [-Math.PI / 2, 0, 0], hell ? 0.8 : 0.25); // heller Boden spiegelt sich in den Flanken
    flaeche(14, 4.5, [0, 10.9, 0], [Math.PI / 2, 0, 0], 5); // große Deckenbox
    flaeche(1, 12, [-4.6, 10.8, 0], [Math.PI / 2, 0, 0], 7); // zwei lange Lichtbalken (Kanten im Lack)
    flaeche(1, 12, [4.6, 10.8, 0], [Math.PI / 2, 0, 0], 7);
    flaeche(18, 0.9, [0, 3.6, -11.8], [0, 0, 0], 4.5); // Lichtstreifen seitlich (Gürtellinie)
    flaeche(18, 0.9, [0, 3.6, 11.8], [0, Math.PI, 0], 4.5);
    flaeche(5, 4, [-11.8, 4, 0], [0, Math.PI / 2, 0], 2.4);
    flaeche(5, 4, [11.8, 4, 0], [0, -Math.PI / 2, 0], 2.4);
    return env;
  }
  const umgebungCache = new WeakMap();
  /** Liefert sofort eine Umgebung (Softboxen) und ruft fertig(tex) noch einmal mit der HDR-Version auf. */
  function umgebung(renderer, { hell = true, fertig } = {}) {
    const key = umgebungCache.get(renderer) || {};
    umgebungCache.set(renderer, key);
    const name = hell ? "hell" : "dunkel";
    const backe = (hdr) => {
      const pm = new THREE.PMREMGenerator(renderer);
      const tex = pm.fromScene(softboxSzene(hdr, hell), 0.015).texture;
      pm.dispose();
      return tex;
    };
    if (!key[name]) key[name] = { tex: backe(null), hdr: null };
    const e = key[name];
    if (!e.hdr) {
      e.hdr = ladeHdr().then((hdr) => {
        if (!hdr) return e.tex;
        e.tex = backe(hdr);
        return e.tex;
      });
    }
    if (fertig) e.hdr.then((t) => t && fertig(t));
    return e.tex;
  }

  // ---------- 2. Kontaktschatten ----------
  const blurVert = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
  const blurFrag = (achse) => `uniform sampler2D tDiffuse; uniform float h; varying vec2 vUv;
    void main(){ vec4 s = vec4(0.0); vec2 d = ${achse === "h" ? "vec2(h, 0.0)" : "vec2(0.0, h)"};
      s += texture2D(tDiffuse, vUv - 4.0*d) * 0.051; s += texture2D(tDiffuse, vUv - 3.0*d) * 0.0918;
      s += texture2D(tDiffuse, vUv - 2.0*d) * 0.12245; s += texture2D(tDiffuse, vUv - 1.0*d) * 0.1531;
      s += texture2D(tDiffuse, vUv) * 0.1633;
      s += texture2D(tDiffuse, vUv + 1.0*d) * 0.1531; s += texture2D(tDiffuse, vUv + 2.0*d) * 0.12245;
      s += texture2D(tDiffuse, vUv + 3.0*d) * 0.0918; s += texture2D(tDiffuse, vUv + 4.0*d) * 0.051;
      gl_FragColor = s; }`;

  /**
   * Kontaktschatten unter einem Objekt. schicht = { hoehe, weich, dunkel }: wie weit nach oben das Auto
   * Schatten wirft, wie weich, wie dunkel. Zwei Schichten: eng an den Reifen + weich unter der Karosserie.
   */
  function kontaktSchatten(renderer, { aufloesung = 512, schichten = [{ hoehe: 0.28, weich: 1.2, dunkel: 1.25 }, { hoehe: 1.4, weich: 5, dunkel: 0.9 }] } = {}) {
    const gruppe = new THREE.Group();
    gruppe.name = "kontaktschatten";
    const opt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
    const blurCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
    const blurQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
    blurQuad.position.z = -0.5;
    const blurSzene = new THREE.Scene(); blurSzene.add(blurQuad);
    const hMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, h: { value: 0 } }, vertexShader: blurVert, fragmentShader: blurFrag("h"), depthTest: false, depthWrite: false, transparent: true });
    const vMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, h: { value: 0 } }, vertexShader: blurVert, fragmentShader: blurFrag("v"), depthTest: false, depthWrite: false, transparent: true });

    const lagen = schichten.map((s) => {
      const rt = new THREE.WebGLRenderTarget(aufloesung, aufloesung, opt);
      const rt2 = new THREE.WebGLRenderTarget(aufloesung, aufloesung, opt);
      rt.texture.generateMipmaps = rt2.texture.generateMipmaps = false;
      const tiefe = new THREE.MeshDepthMaterial({ side: THREE.DoubleSide });
      tiefe.userData.dunkel = { value: s.dunkel };
      tiefe.onBeforeCompile = (sh) => {
        sh.uniforms.dunkel = tiefe.userData.dunkel;
        sh.fragmentShader = "uniform float dunkel;\n" + sh.fragmentShader.replace("gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );", "gl_FragColor = vec4( vec3( 0.0 ), pow( 1.0 - fragCoordZ, 1.6 ) * dunkel );");
      };
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, s.hoehe);
      cam.rotation.x = Math.PI / 2; // schaut von unten nach oben
      const flaeche = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rt.texture, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
      flaeche.rotation.x = -Math.PI / 2;
      flaeche.renderOrder = 3;
      gruppe.add(flaeche);
      return { ...s, rt, rt2, tiefe, cam, flaeche };
    });

    function weich(l, staerke) {
      blurQuad.material = hMat; hMat.uniforms.tDiffuse.value = l.rt.texture; hMat.uniforms.h.value = staerke / aufloesung;
      renderer.setRenderTarget(l.rt2); renderer.render(blurSzene, blurCam);
      blurQuad.material = vMat; vMat.uniforms.tDiffuse.value = l.rt2.texture; vMat.uniforms.h.value = staerke / aufloesung;
      renderer.setRenderTarget(l.rt); renderer.render(blurSzene, blurCam);
    }

    /** Einmal rechnen, wenn ein Auto gesetzt wurde (das Auto bewegt sich nicht, nur die Kamera). */
    function rechne(szene, objekt) {
      if (!objekt) { gruppe.visible = false; return; }
      objekt.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(objekt), size = bb.getSize(new THREE.Vector3()), mitte = bb.getCenter(new THREE.Vector3());
      const w = size.x * 1.35 + 0.6, d = size.z * 1.35 + 0.6;
      // Alles außer dem Objekt kurz ausblenden (das Objekt hängt direkt an der Szene)
      const aus = szene.children.filter((o) => o !== objekt && o.visible);
      aus.forEach((o) => { o.visible = false; });
      const bg = szene.background, fog = szene.fog, alt = renderer.getRenderTarget(), altClear = renderer.getClearAlpha(), altFarbe = renderer.getClearColor(new THREE.Color());
      szene.background = null; szene.fog = null;
      renderer.setClearColor(0x000000, 0);
      for (const l of lagen) {
        l.cam.left = -w / 2; l.cam.right = w / 2; l.cam.top = d / 2; l.cam.bottom = -d / 2;
        l.cam.position.set(mitte.x, bb.min.y + 0.001, mitte.z); l.cam.far = l.hoehe; l.cam.updateProjectionMatrix();
        l.flaeche.scale.set(w, d, 1); l.flaeche.position.set(mitte.x, 0.003 + lagen.indexOf(l) * 0.0005, mitte.z);
        szene.overrideMaterial = l.tiefe;
        renderer.setRenderTarget(l.rt); renderer.clear(); renderer.render(szene, l.cam);
        szene.overrideMaterial = null;
        weich(l, l.weich); weich(l, l.weich * 0.5);
      }
      renderer.setRenderTarget(alt); renderer.setClearColor(altFarbe, altClear);
      szene.background = bg; szene.fog = fog;
      aus.forEach((o) => { o.visible = true; });
      gruppe.visible = true;
    }
    function dispose() { lagen.forEach((l) => { l.rt.dispose(); l.rt2.dispose(); l.tiefe.dispose(); l.flaeche.geometry.dispose(); l.flaeche.material.dispose(); }); hMat.dispose(); vMat.dispose(); }
    return { gruppe, rechne, dispose };
  }

  // ---------- 3. Weiche Spiegelung ----------
  // Spiegel-Kopie bekommt eigene Materialien, die nach unten in die Bodenfarbe ausblenden.
  function spiegelMaterial(spiegel, bodenFarbe = "#e8eaed", hoehe = 0.9) {
    const farbe = new THREE.Color(bodenFarbe); // sRGB-Ausgabe, darum ohne Umrechnung
    const cache = new Map();
    const umbauen = (m) => {
      if (!m) return m;
      if (cache.has(m)) return cache.get(m);
      const k = m.clone();
      k.onBeforeCompile = (sh) => {
        sh.uniforms.fsBoden = { value: farbe };
        sh.uniforms.fsHoehe = { value: hoehe };
        sh.vertexShader = "varying float fsY;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n fsY = (modelMatrix * vec4(transformed, 1.0)).y;");
        sh.fragmentShader = "uniform vec3 fsBoden; uniform float fsHoehe; varying float fsY;\n" + sh.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fsBoden, smoothstep(0.0, fsHoehe, -fsY) * 0.92 + 0.08);");
      };
      k.customProgramCacheKey = () => "fs-spiegel-" + m.type;
      cache.set(m, k);
      return k;
    };
    spiegel.traverse((o) => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map(umbauen) : umbauen(o.material);
      o.castShadow = false;
    });
    return spiegel;
  }

  // ---------- 4. Fertige 3D-Modelle aufbereiten ----------
  const LACK_NAME = /paint|lack|body|carpaint|car_paint|exterior|karosserie|bodywork|shell|coat/i;
  const NICHT_LACK = /glass|glas|window|scheibe|tire|tyre|reifen|rubber|rim|wheel|felge|chrome|chrom|light|lamp|interior|seat|leather|plastic|grill|brake|disc|caliper|logo|badge|emblem|plate|kennzeichen|mirror_glass|black/i;
  /** Findet die Lackteile eines Modells: Klarlack-Materialien oder Name nach Lack, sonst die größte bunte Fläche. */
  function lackTeile(obj) {
    const kandidaten = new Map();
    obj.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || !m.color || m.transparent && m.opacity < 0.9) continue;
        const name = `${m.name || ""} ${o.name || ""}`;
        if (NICHT_LACK.test(m.name || "")) continue;
        const pos = o.geometry?.attributes?.position;
        const flaeche = pos ? pos.count : 0;
        const e = kandidaten.get(m) || { m, punkte: 0, flaeche: 0 };
        e.flaeche += flaeche;
        if ((m.clearcoat || 0) > 0.2) e.punkte += 3;
        if (LACK_NAME.test(name)) e.punkte += 2;
        const hsl = m.color.getHSL({});
        if (hsl.s > 0.25 && !m.map) e.punkte += 1;
        kandidaten.set(m, e);
      }
    });
    const liste = [...kandidaten.values()];
    if (!liste.length) return [];
    // Hauptlack: unter den Lack-Kandidaten der hellste/bunteste mit der größten Fläche (Zweifarb-Lack: Dach bleibt)
    const hellig = (e) => e.m.color.getHSL({}).l;
    let treffer = liste.filter((e) => e.punkte >= 2);
    if (!treffer.length) treffer = liste.filter((e) => !e.m.map && e.punkte >= 1);
    if (!treffer.length) treffer = liste.filter((e) => !e.m.map);
    if (!treffer.length) return [];
    const bunt = treffer.filter((e) => hellig(e) > 0.06);
    if (bunt.length) treffer = bunt;
    treffer = [treffer.sort((a, b) => b.flaeche - a.flaeche)[0]];
    return treffer.map((e) => e.m);
  }
  const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  /** Färbt Lackteile um – MeshStandard wird dazu ein echtes Klarlack-Material. Gibt die (neuen) Materialien zurück. */
  function lackFaerben(obj, teile, hex) {
    const neu = new Map();
    for (const m of teile) {
      let k = m;
      if (!m.isMeshPhysicalMaterial) {
        k = new THREE.MeshPhysicalMaterial();
        THREE.MeshStandardMaterial.prototype.copy.call(k, m);
        k.name = m.name;
      }
      if (hex) { k.color.copy(lin(hex)); if (k.map && k.map !== null) k.map = null; }
      const hell = k.color.getHSL({}).l;
      k.metalness = hex ? (hell < 0.06 ? 0.35 : 0.6) : Math.max(0.2, k.metalness);
      k.roughness = Math.min(k.roughness ?? 0.4, 0.38);
      k.clearcoat = 1; k.clearcoatRoughness = 0.03;
      if (hex) { // neue Farbe: Struktur-Karten des alten Lacks dämpfen, sonst wirkt er wie Schmirgelpapier
        k.roughnessMap = null; k.metalnessMap = null;
        if (k.normalMap) k.normalScale.set(0.12, 0.12);
        k.roughness = 0.32;
      }
      k.envMapIntensity = 1.15;
      k.needsUpdate = true;
      neu.set(m, k);
    }
    if (neu.size) obj.traverse((o) => {
      if (!o.isMesh) return;
      if (Array.isArray(o.material)) o.material = o.material.map((m) => neu.get(m) || m);
      else if (neu.has(o.material)) o.material = neu.get(o.material);
    });
    return teile.map((m) => neu.get(m) || m);
  }
  /** Glas, Reifen, Chrom: so einstellen, dass es im Studio echt wirkt (three r128 kann kein echtes Durchscheinen). */
  function modellAufbereiten(obj) {
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m) continue;
        const name = `${m.name || ""} ${o.name || ""}`;
        if (m.transmission > 0 || /glass|glas|window|windshield|scheibe/i.test(m.name || "")) {
          m.transmission = 0; m.transparent = true; m.opacity = Math.min(m.opacity ?? 1, 0.42);
          m.color?.setRGB(0.03, 0.035, 0.045); m.roughness = 0.02; m.metalness = 0.1; m.depthWrite = false;
          if ("clearcoat" in m) m.clearcoat = 1;
          m.envMapIntensity = 1.8;
        } else if (/tire|tyre|reifen|rubber/i.test(name)) {
          m.roughness = Math.max(m.roughness ?? 0.9, 0.85); m.metalness = 0; m.envMapIntensity = 0.5;
        } else if (/chrome|chrom/i.test(name)) {
          m.metalness = 1; m.roughness = Math.min(m.roughness ?? 0.1, 0.12); m.envMapIntensity = 1.4;
        } else if ("envMapIntensity" in m) {
          m.envMapIntensity = Math.max(m.envMapIntensity || 1, 1.05);
        }
        m.needsUpdate = true;
      }
    });
    return obj;
  }

  /** Tiefster echter Punkt (Ecken-Boxen sind bei gedrehten Rädern zu grob → Auto schwebt sonst). */
  function tiefsterPunkt(obj) {
    obj.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    let min = Infinity;
    obj.traverse((o) => {
      const pos = o.isMesh && o.geometry?.attributes?.position;
      if (!pos || o.isSkinnedMesh) return;
      const schritt = Math.max(1, Math.floor(pos.count / 40000));
      for (let i = 0; i < pos.count; i += schritt) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (v.y < min) min = v.y; }
    });
    return Number.isFinite(min) ? min : null;
  }

  window.FridayFoto = { tiefsterPunkt, umgebung, ladeHdr, kontaktSchatten, spiegelMaterial, lackTeile, lackFaerben, modellAufbereiten };
})();
