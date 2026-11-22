// Zerlege-Labor (v1.143.0, zuerst nur in Eve): Fridays Teile-Datenbank für die Werkstatt.
// Jedes Modell besteht aus echten Bauteilen in echter Größe (Meter) und echter Lage, sortiert in Baugruppen.
// Das Dashboard (dashboard/zerlegelabor.js) baut daraus ein 3D-Modell, das man zerlegen kann:
// Motor herausnehmen, Karosserie abheben, Teile greifen und verschieben, Explosionsansicht, "Motor läuft"
// (Kolben, Kurbelwelle, Räder, Lüfter, Turbinen bewegen sich).
// Alles ohne Claude und ohne Internet. Die Modelle sind allgemeine Bauarten, keine Markenmodelle.
import { config, IST_EVE } from "./config.js";
import { istFrei } from "./eve.js";

export const FUNKTION_ID = "zerlege-labor";
export const frei = () => IST_EVE || istFrei(FUNKTION_ID);
const boss = () => config.userName || "Chef";

const PI = Math.PI;
const C45 = Math.SQRT1_2;
const r3 = (v) => Math.round(v * 1000) / 1000;
const v3 = (a) => a.map(r3);

// ---------- Wissen zu jedem Bauteil (gilt für alle Modelle) ----------
// funktion, material, gewicht, ausbau (wie man es in echt herausnimmt), wissen (ein Satz zum Staunen)
const ARTEN = {
  // Karosserie & Fahrwerk
  karosserie: { funktion: "Die Außenhaut: schützt Insassen und Technik, sorgt für wenig Luftwiderstand und trägt beim Unfall die Kräfte.", material: "Stahl, Aluminium, Kohlefaser", gewicht: "ca. 300–400 kg", ausbau: "In der Fabrik heißt das „Hochzeit“: Die Karosserie wird mit dem Antriebsstrang verschraubt – zum Trennen hebt man sie mit dem Kran ab.", wissen: "Eine moderne Karosserie hat rund 5.000 Schweißpunkte." },
  rad: { funktion: "Überträgt Antriebs-, Brems- und Lenkkräfte auf die Straße. Der Reifen ist die einzige Verbindung zur Fahrbahn.", material: "Gummi (Reifen), Aluminium-Guss oder geschmiedet (Felge)", gewicht: "ca. 20–25 kg", ausbau: "Radschrauben lösen, Auto aufbocken, Schrauben raus, Rad abnehmen.", werkzeug: "Radkreuz, Wagenheber, Drehmomentschlüssel (ca. 120 Nm)", wissen: "Die Auflagefläche eines Reifens ist nur etwa so groß wie eine Postkarte." },
  bremsscheibe: { funktion: "Dreht sich mit dem Rad. Die Bremsbeläge pressen darauf und wandeln Bewegung in Wärme um.", material: "Grauguss, bei Sportwagen Carbon-Keramik", gewicht: "ca. 8–12 kg", ausbau: "Rad ab, Bremssattel abschrauben, Scheibe von der Nabe ziehen.", wissen: "Bei einer Vollbremsung aus 200 km/h glüht die Scheibe mit über 600 °C." },
  bremssattel: { funktion: "Hält die Bremsbeläge und drückt sie mit Hydraulik-Kolben gegen die Bremsscheibe.", material: "Aluminium, lackiert", gewicht: "ca. 3–5 kg", ausbau: "Bremsleitung abklemmen, zwei Halteschrauben lösen, Sattel abnehmen.", wissen: "Sportwagen haben bis zu 10 Kolben in einem Sattel." },
  feder: { funktion: "Fängt Stöße der Straße ab und trägt das Gewicht des Fahrzeugs.", material: "Federstahl", gewicht: "ca. 2 kg", ausbau: "Nur mit Federspanner! Die Feder steht unter hoher Spannung.", werkzeug: "Federspanner", wissen: "Eine Autofeder trägt rund 400 kg." },
  daempfer: { funktion: "Bremst das Nachschwingen der Feder, damit das Auto nicht hüpft.", material: "Stahlrohr mit Öl und Gas", gewicht: "ca. 2–3 kg", ausbau: "Zusammen mit der Feder als Federbein ausbauen.", wissen: "Adaptive Dämpfer verstellen sich bis zu 1.000-mal pro Sekunde." },
  querlenker: { funktion: "Verbindet das Rad mit der Karosserie und führt es beim Einfedern.", material: "Aluminium-Schmiedeteil", gewicht: "ca. 2–4 kg", ausbau: "Kugelgelenk und Lagerschrauben lösen.", wissen: "Querlenker entscheiden, wie präzise ein Auto lenkt." },
  lenkgetriebe: { funktion: "Macht aus der Drehung des Lenkrads die Seitwärtsbewegung der Räder (Zahnstange).", material: "Stahl, Aluminium-Gehäuse", gewicht: "ca. 8–10 kg", ausbau: "Spurstangen und Lenksäule lösen, Halter abschrauben.", wissen: "Moderne Lenkungen haben einen Elektromotor zur Unterstützung." },
  // V8-Motor
  motorblock: { funktion: "Das Herz des Motors: hält Kurbelwelle und Zylinder, darin laufen Öl- und Kühlkanäle.", material: "Aluminium-Guss", gewicht: "ca. 45 kg", ausbau: "Erst Anbauteile, Zylinderköpfe und Ölwanne abbauen – der Block bleibt zuletzt übrig.", wissen: "Ein V8-Block wird auf hundertstel Millimeter genau gefräst." },
  zylinderbank: { funktion: "Eine Reihe von vier Zylindern. Ein V8 hat zwei Bänke im 90°-Winkel.", material: "Aluminium mit beschichteten Laufbahnen", gewicht: "Teil des Blocks", ausbau: "Gehört fest zum Motorblock.", wissen: "Die V-Form macht den Motor kurz – er passt so auch in kompakte Sportwagen." },
  zylinderkopf: { funktion: "Verschließt die Zylinder oben. Darin sitzen Ventile, Nockenwellen und Zündkerzen.", material: "Aluminium-Guss", gewicht: "ca. 15 kg", ausbau: "Ventildeckel ab, Steuerkette lösen, Kopfschrauben über Kreuz lösen.", werkzeug: "Drehmoment- und Winkelschlüssel", wissen: "Die Kopfdichtung muss über 100 bar Verbrennungsdruck dicht halten." },
  ventildeckel: { funktion: "Deckt Nockenwellen und Ventile ab und hält das Öl im Motor.", material: "Aluminium oder Kunststoff, oft lackiert", gewicht: "ca. 1,5 kg", ausbau: "Zündspulen abziehen, ca. 12 Schrauben lösen.", wissen: "Rote Ventildeckel sind bei Rennmotoren ein Markenzeichen." },
  kolben: { funktion: "Wird von der Explosion des Kraftstoff-Luft-Gemischs nach unten gedrückt und treibt über das Pleuel die Kurbelwelle an.", material: "Aluminium-Legierung, geschmiedet", gewicht: "ca. 400 g", ausbau: "Zylinderkopf und Ölwanne ab, Pleuellager lösen, Kolben nach oben herausschieben.", wissen: "Bei 7.000 U/min ändert ein Kolben 230-mal pro Sekunde die Richtung." },
  pleuel: { funktion: "Verbindet Kolben und Kurbelwelle – macht aus Auf-und-ab eine Drehung.", material: "Stahl oder Titan, geschmiedet", gewicht: "ca. 550 g", ausbau: "Zusammen mit dem Kolben ausbauen.", wissen: "Ein Pleuel trägt bei jeder Zündung mehrere Tonnen Kraft." },
  kurbelwelle: { funktion: "Sammelt die Kraft aller Kolben und gibt sie als Drehung an Getriebe und Räder weiter.", material: "Stahl, geschmiedet", gewicht: "ca. 22 kg", ausbau: "Motor komplett zerlegen, Hauptlagerdeckel abschrauben, Welle herausheben.", wissen: "Bei einem „Crossplane“-V8 stehen die Kröpfungen im 90°-Kreuz – das gibt den typischen Blubber-Sound." },
  oelwanne: { funktion: "Sammelt das Motoröl unter der Kurbelwelle. Die Ölpumpe saugt es hier an.", material: "Aluminium oder Stahlblech", gewicht: "ca. 4 kg", ausbau: "Öl ablassen, Schrauben rundum lösen, Wanne abnehmen.", wissen: "Ein V8 braucht 8–9 Liter Öl." },
  ansaugbruecke: { funktion: "Verteilt die angesaugte Luft gleichmäßig auf alle acht Zylinder.", material: "Aluminium oder Kunststoff, Carbon-Deckel", gewicht: "ca. 5 kg", ausbau: "Luftschläuche und Stecker lösen, Brücke abschrauben.", wissen: "Die Länge der Kanäle ist genau berechnet – sie verstärkt die Luftwellen." },
  drosselklappe: { funktion: "Die Klappe hinter dem Gaspedal: regelt, wie viel Luft in den Motor strömt.", material: "Aluminium", gewicht: "ca. 1 kg", ausbau: "Stecker ab, 4 Schrauben lösen.", wissen: "Sie wird elektrisch gesteuert („Drive by Wire“)." },
  turbo_gehaeuse: { funktion: "Schneckengehäuse des Turboladers: Abgas treibt hier eine Turbine an.", material: "Hitzebeständiger Stahlguss", gewicht: "ca. 8 kg", ausbau: "Ölleitungen, Abgasrohr und Ladeluftschlauch lösen.", wissen: "Das Gehäuse wird bis zu 1.000 °C heiß und glüht dabei rot." },
  turbo_rad: { funktion: "Das Verdichterrad presst zusätzliche Luft in den Motor – mehr Luft heißt mehr Leistung.", material: "Aluminium (Verdichter), Inconel (Turbine)", gewicht: "ca. 300 g", ausbau: "Nur zusammen mit dem Turbolader.", wissen: "Ein Turbo dreht bis zu 200.000-mal pro Minute." },
  kruemmer: { funktion: "Sammelt das heiße Abgas aus den Zylindern und leitet es zum Turbo.", material: "Edelstahl", gewicht: "ca. 4 kg", ausbau: "Muttern am Zylinderkopf lösen (oft festgerostet).", wissen: "Die Rohre sind gleich lang, damit sich die Abgaspulse nicht stören." },
  lichtmaschine: { funktion: "Erzeugt Strom fürs Bordnetz und lädt die Batterie, angetrieben über einen Riemen.", material: "Aluminium-Gehäuse, Kupferwicklung", gewicht: "ca. 6 kg", ausbau: "Riemen entspannen, Kabel ab, zwei Schrauben lösen.", wissen: "Sie liefert bis zu 200 Ampere." },
  riemenscheibe: { funktion: "Sitzt vorne auf der Kurbelwelle und treibt über den Riemen Lichtmaschine, Wasserpumpe und Klima an.", material: "Stahl mit Gummi-Dämpfer", gewicht: "ca. 2 kg", ausbau: "Zentralschraube lösen – sie sitzt sehr fest.", wissen: "Der Gummiring darin schluckt Schwingungen der Kurbelwelle." },
  zuendspule: { funktion: "Macht aus 12 Volt bis zu 40.000 Volt für den Zündfunken.", material: "Kunststoff, Kupferwicklung", gewicht: "ca. 200 g", ausbau: "Stecker ab, Spule nach oben herausziehen.", wissen: "Jeder Zylinder hat seine eigene Spule." },
  schwungrad: { funktion: "Schwere Scheibe am Ende der Kurbelwelle: glättet die Drehung und trägt die Kupplung.", material: "Stahl", gewicht: "ca. 10 kg", ausbau: "Getriebe und Kupplung ab, Schrauben lösen.", wissen: "Ein Zweimassen-Schwungrad hat innen Federn gegen Vibrationen." },
  nockenwelle: { funktion: "Öffnet und schließt die Ventile genau im richtigen Moment – dreht halb so schnell wie die Kurbelwelle.", material: "Stahl, gehärtet", gewicht: "ca. 3 kg", ausbau: "Ventildeckel ab, Kette lösen, Lagerdeckel abschrauben.", wissen: "Ein V8 mit 32 Ventilen hat vier Nockenwellen." },
  ventil: { funktion: "Lässt frische Luft herein (Einlass) oder Abgas heraus (Auslass).", material: "Stahl, Auslass mit Natrium gefüllt", gewicht: "ca. 50 g", ausbau: "Zylinderkopf ab, Ventilfeder spannen, Keile entfernen.", werkzeug: "Ventilfederspanner", wissen: "Ein Ventil öffnet bei Vollgas über 50-mal pro Sekunde." },
  zuendkerze: { funktion: "Erzeugt den Funken, der das Gemisch im Zylinder entzündet.", material: "Keramik, Iridium-Spitze", gewicht: "ca. 50 g", ausbau: "Zündspule ab, Kerze mit dem Kerzenschlüssel herausdrehen.", werkzeug: "Zündkerzenschlüssel 14 mm", wissen: "Eine Kerze zündet in ihrem Leben über 100 Millionen Mal." },
  steuerkette: { funktion: "Verbindet Kurbelwelle und Nockenwellen, damit Kolben und Ventile im Takt laufen.", material: "Stahl", gewicht: "ca. 1 kg", ausbau: "Steuerdeckel ab, Spanner lösen – Motor vorher auf Markierung drehen!", wissen: "Springt die Kette über, treffen Kolben auf Ventile – Totalschaden." },
  wasserpumpe: { funktion: "Pumpt Kühlwasser durch Motor und Kühler.", material: "Aluminium, Kunststoff-Flügelrad", gewicht: "ca. 2 kg", ausbau: "Kühlwasser ablassen, Riemen ab, Pumpe abschrauben.", wissen: "Sie bewegt über 200 Liter pro Minute." },
  oelfilter: { funktion: "Filtert Metallabrieb und Schmutz aus dem Motoröl.", material: "Stahlgehäuse, Papier-Filtereinsatz", gewicht: "ca. 400 g", ausbau: "Mit dem Filterschlüssel abdrehen – bei jedem Ölwechsel neu.", wissen: "Er hält Teilchen auf, die 20-mal dünner als ein Haar sind." },
  // Kühlung, Antrieb, Abgas
  kuehler: { funktion: "Gibt die Wärme des Kühlwassers an den Fahrtwind ab.", material: "Aluminium-Lamellen", gewicht: "ca. 6 kg", ausbau: "Wasser ablassen, Schläuche ab, Kühler nach oben herausnehmen.", wissen: "Ein Motor muss etwa so viel Wärme loswerden, wie er an Leistung abgibt." },
  luefter: { funktion: "Saugt Luft durch den Kühler, wenn der Fahrtwind nicht reicht (Stau, Ampel).", material: "Kunststoff, Elektromotor", gewicht: "ca. 3 kg", ausbau: "Stecker ab, Rahmen abschrauben.", wissen: "Er springt bei etwa 100 °C Wassertemperatur an." },
  kuehlschlauch: { funktion: "Führt Kühlwasser zwischen Motor und Kühler hin und zurück.", material: "Gummi mit Gewebe", gewicht: "ca. 300 g", ausbau: "Schellen lösen, Schlauch abziehen.", wissen: "Der obere Schlauch ist heiß (ca. 90 °C), der untere kühler." },
  getriebe: { funktion: "Übersetzt die Motordrehzahl in passende Raddrehzahlen – für Anfahren und Höchstgeschwindigkeit.", material: "Aluminium-Gehäuse, Stahl-Zahnräder", gewicht: "ca. 60–80 kg", ausbau: "Kardanwelle, Schaltung und Kabel lösen, Getriebe mit Getriebeheber absenken.", werkzeug: "Getriebeheber", wissen: "Ein Doppelkupplungsgetriebe schaltet in 0,1 Sekunden." },
  kardanwelle: { funktion: "Lange Welle, die die Kraft vom Getriebe nach hinten zum Differenzial bringt.", material: "Stahl oder Kohlefaser-Rohr", gewicht: "ca. 10 kg", ausbau: "Flansche hinten und vorne lösen, Mittellager abschrauben.", wissen: "Sie dreht bei Höchstgeschwindigkeit über 6.000-mal pro Minute." },
  differenzial: { funktion: "Verteilt die Kraft auf linkes und rechtes Rad – in Kurven drehen sie verschieden schnell.", material: "Stahlguss, Kegelräder", gewicht: "ca. 30 kg", ausbau: "Antriebswellen und Kardanwelle lösen, Halter abschrauben.", wissen: "Ohne Differenzial würde ein Rad in jeder Kurve radieren." },
  antriebswelle: { funktion: "Verbindet Differenzial und Rad, mit Gelenken, damit das Rad federn kann.", material: "Stahl", gewicht: "ca. 6 kg", ausbau: "Nabenmutter lösen, Welle aus dem Differenzial ziehen.", wissen: "Die Gelenke heißen Gleichlaufgelenke und laufen in Fett." },
  katalysator: { funktion: "Wandelt giftige Abgase (CO, NOx) in harmlose Gase um.", material: "Keramik-Wabe mit Platin, Rhodium, Palladium", gewicht: "ca. 5 kg", ausbau: "Flansche vorne und hinten lösen.", wissen: "Die Edelmetalle darin sind so wertvoll, dass Kats gestohlen werden." },
  abgasrohr: { funktion: "Leitet das Abgas unter dem Auto nach hinten.", material: "Edelstahl", gewicht: "ca. 6 kg", ausbau: "Gummi-Halter abziehen, Schellen lösen.", wissen: "Hängt in Gummi, damit keine Vibrationen ins Auto gehen." },
  endtopf: { funktion: "Dämpft den Auspuffklang und enthält oft Klappen für Sport-Sound.", material: "Edelstahl", gewicht: "ca. 12 kg", ausbau: "Schellen und Halter lösen.", wissen: "Mit offenen Klappen wird ein V8 deutlich lauter." },
  endrohr: { funktion: "Die sichtbaren Rohre am Heck.", material: "Edelstahl, poliert", gewicht: "ca. 500 g", ausbau: "Klemmschraube lösen, abziehen.", wissen: "Vier Endrohre verraten meist einen V8." },
  tank: { funktion: "Speichert den Kraftstoff, sicher vor dem Unfall geschützt vor der Hinterachse.", material: "Kunststoff (HDPE)", gewicht: "ca. 10 kg leer", ausbau: "Tank leer pumpen, Leitungen ab, Spannbänder lösen, absenken.", wissen: "Der Tank hat innen Schwallwände, damit der Sprit in Kurven nicht schwappt." },
  kraftstoffleitung: { funktion: "Bringt Benzin vom Tank zu den Einspritzdüsen – unter Hochdruck.", material: "Stahl- und Kunststoffleitung", gewicht: "ca. 1 kg", ausbau: "Druck abbauen, Steckkupplungen lösen.", wissen: "Direkteinspritzer arbeiten mit bis zu 350 bar." },
  // Innenraum & Elektrik
  sitz: { funktion: "Hält dich in Kurven seitlich fest und schützt bei einem Unfall (Kopfstütze, Seitenairbag).", material: "Stahlrahmen, Schaum, Leder", gewicht: "ca. 20–30 kg", ausbau: "Batterie ab (Airbag!), 4 Schrauben an den Schienen lösen, Stecker ab.", wissen: "Ein Sportsitz hat bis zu 18 elektrische Verstellungen." },
  lenkrad: { funktion: "Damit lenkst du. Darin sitzen Airbag und Tasten.", material: "Magnesium-Kern, Leder", gewicht: "ca. 2 kg", ausbau: "Batterie ab, Airbag ausclipsen, Zentralmutter lösen.", wissen: "Der Airbag bläst sich in 30 Millisekunden auf." },
  lenksaeule: { funktion: "Verbindet Lenkrad und Lenkgetriebe, knickt beim Unfall weg.", material: "Stahl", gewicht: "ca. 5 kg", ausbau: "Verkleidung ab, Gelenk unten lösen.", wissen: "Sie ist teleskopisch – man kann sie in Länge und Höhe verstellen." },
  armaturenbrett: { funktion: "Trägt Anzeigen, Lüftung, Beifahrer-Airbag und Bildschirme.", material: "Kunststoff auf Magnesium-Träger", gewicht: "ca. 15 kg", ausbau: "Einer der aufwendigsten Ausbauten im Auto – viele Stunden Arbeit.", wissen: "Dahinter verlaufen mehrere Kilometer Kabel." },
  mittelkonsole: { funktion: "Zwischen den Sitzen: Schalthebel, Ablagen, Bedienelemente.", material: "Kunststoff, Leder", gewicht: "ca. 4 kg", ausbau: "Verkleidungen abclipsen, Schrauben lösen.", wissen: "Darunter liegt der Getriebetunnel." },
  schalthebel: { funktion: "Wählt den Gang oder die Fahrstufe.", material: "Aluminium, Leder", gewicht: "ca. 300 g", ausbau: "Manschette ab, Hebel abziehen.", wissen: "Bei modernen Autos ist er nur noch ein elektrischer Schalter." },
  batterie: { funktion: "12-Volt-Batterie für Anlasser, Licht und Steuergeräte.", material: "Blei-Säure oder AGM", gewicht: "ca. 18 kg", ausbau: "Erst Minus-, dann Pluspol lösen, Halteklammer ab.", wissen: "Immer zuerst den Minuspol abklemmen – sonst droht ein Kurzschluss." },
  steuergeraet: { funktion: "Der Motor-Computer: steuert Einspritzung, Zündung und Turbodruck tausendfach pro Sekunde.", material: "Platine im Alu-Gehäuse", gewicht: "ca. 1 kg", ausbau: "Stecker entriegeln, Halter lösen.", wissen: "Ein Auto hat heute 70–100 Steuergeräte." },
  kabelbaum: { funktion: "Alle Stromleitungen des Autos in einem Strang.", material: "Kupfer, Kunststoff-Isolierung", gewicht: "ca. 50 kg im ganzen Auto", ausbau: "Nur bei großen Reparaturen – sehr aufwendig.", wissen: "Zusammen sind die Kabel eines Autos bis zu 5 km lang." },
  // Elektroauto
  akkuwanne: { funktion: "Stabile Wanne im Unterboden, schützt die Batterie bei Unfällen und von unten.", material: "Aluminium-Strangpressprofile", gewicht: "ca. 80 kg", ausbau: "Nur Fachwerkstatt: Hochvolt abschalten, Auto auf Hebebühne, Wanne mit Spezialheber absenken.", werkzeug: "Isoliertes Werkzeug, Akku-Heber", wissen: "Der tiefe Akku macht E-Autos in Kurven sehr stabil." },
  akkumodul: { funktion: "Ein Paket aus vielen Lithium-Ionen-Zellen. Zusammen speichern sie die Energie fürs Fahren.", material: "Lithium-Ionen-Zellen, Aluminium-Rahmen", gewicht: "ca. 25–30 kg", ausbau: "Nur Hochvolt-Fachkraft! Akkudeckel ab, Stromschienen lösen, Modul herausheben.", wissen: "Ein großer Akku hat über 4.000 einzelne Zellen." },
  akkudeckel: { funktion: "Schließt die Batterie dicht ab (wasserdicht nach IP67).", material: "Aluminium oder Verbundstoff", gewicht: "ca. 15 kg", ausbau: "Viele Schrauben rundum lösen, Dichtung erneuern.", wissen: "Der Akku muss sogar kurz unter Wasser dicht bleiben." },
  bms: { funktion: "Batterie-Management: überwacht jede Zelle (Spannung, Temperatur) und schützt den Akku.", material: "Platine", gewicht: "ca. 1 kg", ausbau: "Im Akku verbaut – nur Fachwerkstatt.", wissen: "Es misst jede Zelle viele Male pro Sekunde." },
  hvkabel: { funktion: "Hochvolt-Leitung (400–800 Volt) zwischen Akku, Inverter und Motor. Immer orange!", material: "Kupfer, dicke orange Isolierung", gewicht: "ca. 3 kg", ausbau: "Niemals selbst! Erst Hochvolt-Trennstecker ziehen, Spannungsfreiheit prüfen.", wissen: "Orange heißt: Lebensgefahr, nur für geschulte Fachleute." },
  emotor_gehaeuse: { funktion: "Gehäuse des Elektromotors mit Kühlkanälen.", material: "Aluminium-Guss", gewicht: "ca. 20 kg", ausbau: "Antriebseinheit komplett mit Getriebe und Inverter absenken.", wissen: "Ein E-Motor hat einen Wirkungsgrad von über 90 % – ein Benziner nur ca. 35 %." },
  stator: { funktion: "Der feststehende Teil des E-Motors mit Kupferwicklungen. Strom erzeugt hier ein drehendes Magnetfeld.", material: "Kupfer, Elektroblech", gewicht: "ca. 25 kg", ausbau: "Nur im Werk.", wissen: "Hairpin-Wicklungen sehen aus wie Haarnadeln – daher der Name." },
  rotor: { funktion: "Der drehende Teil: folgt dem Magnetfeld und treibt über das Getriebe die Räder an.", material: "Elektroblech, Magnete", gewicht: "ca. 15 kg", ausbau: "Nur im Werk.", wissen: "Er dreht bis zu 20.000-mal pro Minute." },
  untersetzung: { funktion: "Ein-Gang-Getriebe: macht die hohe Motordrehzahl langsamer und kräftiger.", material: "Aluminium-Gehäuse, Stahl-Zahnräder", gewicht: "ca. 15 kg", ausbau: "Mit der Antriebseinheit.", wissen: "E-Autos brauchen keine Gänge, weil der Motor von 0 an volle Kraft hat." },
  inverter: { funktion: "Wandelt den Gleichstrom des Akkus in Wechselstrom für den Motor – und regelt so die Leistung.", material: "Leistungselektronik (Siliziumkarbid), Alu-Gehäuse", gewicht: "ca. 8 kg", ausbau: "Hochvolt aus, Kühlwasser und Stromschienen lösen.", wissen: "Beim Bremsen arbeitet er rückwärts und lädt den Akku (Rekuperation)." },
  frunk: { funktion: "Kofferraum vorne („Front-Trunk“) – möglich, weil kein Motor vorne sitzt.", material: "Kunststoff", gewicht: "ca. 3 kg", ausbau: "Clips und Schrauben lösen, herausnehmen.", wissen: "Ins Frunk passen meist 1–2 Reisetaschen." },
  waermepumpe: { funktion: "Heizt und kühlt Innenraum und Akku sehr sparsam.", material: "Aluminium, Kältemittel", gewicht: "ca. 10 kg", ausbau: "Kältemittel absaugen lassen, Leitungen lösen.", wissen: "Spart im Winter bis zu 30 % Reichweitenverlust." },
  ladeanschluss: { funktion: "Hier steckst du das Ladekabel ein (CCS: Wechsel- und Schnellladen).", material: "Kunststoff, Kupferkontakte", gewicht: "ca. 1 kg", ausbau: "Klappe öffnen, Dose von innen abschrauben.", wissen: "Am Schnelllader fließen bis zu 500 Ampere." },
  bordlader: { funktion: "Lädt den Akku an der Haushaltssteckdose und Wallbox (Wechselstrom).", material: "Elektronik im Alu-Gehäuse", gewicht: "ca. 6 kg", ausbau: "Hochvolt aus, Stecker und Kühlleitungen lösen.", wissen: "Typisch sind 11 kW – an der Wallbox in ca. 7 Stunden voll." },
  display: { funktion: "Zentraler Bildschirm für Navigation, Musik und Einstellungen.", material: "Glas, OLED/LCD", gewicht: "ca. 2 kg", ausbau: "Verkleidung abclipsen, Halter lösen, Stecker ab.", wissen: "Manche Autos haben über 1,4 m Bildschirmbreite." },
  // Motorrad
  gabel: { funktion: "Vorderradführung mit eingebauter Federung und Dämpfung.", material: "Stahl- oder Alu-Rohre, Öl", gewicht: "ca. 10 kg (beide)", ausbau: "Vorderrad ab, Klemmschrauben der Gabelbrücke lösen, Rohre nach unten herausziehen.", wissen: "Der Lenkkopfwinkel (ca. 24°) bestimmt, wie stabil das Motorrad geradeaus läuft." },
  gabelbruecke: { funktion: "Verbindet die beiden Gabelrohre mit dem Lenkkopf.", material: "Aluminium, gefräst", gewicht: "ca. 1,5 kg", ausbau: "Lenker ab, Lenkkopfmutter lösen.", wissen: "Sie ist das Drehgelenk zum Lenken." },
  lenker: { funktion: "Lenkt und trägt Gas, Bremse, Kupplung und Schalter.", material: "Aluminium-Rohr", gewicht: "ca. 1 kg", ausbau: "Armaturen lösen, Lenkerklemmen öffnen.", wissen: "Beim Motorrad lenkt man in schnellen Kurven eigentlich in die Gegenrichtung („Lenkimpuls“)." },
  scheinwerfer: { funktion: "Licht nach vorne – heute mit LED.", material: "Kunststoff, LED", gewicht: "ca. 1,5 kg", ausbau: "Stecker ab, Halter lösen.", wissen: "LEDs halten so lange wie das ganze Fahrzeug." },
  rahmen: { funktion: "Das Skelett des Motorrads: verbindet Lenkkopf, Motor und Schwinge.", material: "Aluminium-Brückenrahmen", gewicht: "ca. 10 kg", ausbau: "Alles andere abbauen – der Rahmen bleibt zuletzt übrig.", wissen: "Bei vielen Sportmotorrädern trägt der Motor selbst mit." },
  heckrahmen: { funktion: "Trägt Sitzbank, Rücklicht und Beifahrer.", material: "Stahl- oder Alu-Rohr", gewicht: "ca. 2 kg", ausbau: "Vier Schrauben am Hauptrahmen lösen.", wissen: "Er ist angeschraubt, damit man ihn nach einem Sturz tauschen kann." },
  motorrad_tank: { funktion: "Kraftstofftank zwischen Lenker und Sitz – der Fahrer klemmt ihn mit den Knien.", material: "Stahlblech, lackiert", gewicht: "ca. 4 kg leer", ausbau: "Sitzbank ab, Benzinhahn/Schnellkupplung lösen, Tank hochklappen.", wissen: "Ein Sportmotorrad-Tank fasst ca. 17 Liter." },
  sitzbank: { funktion: "Sitz für Fahrer (und Beifahrer).", material: "Schaum, Kunstleder", gewicht: "ca. 1,5 kg", ausbau: "Mit dem Zündschlüssel am Heck entriegeln.", wissen: "Darunter liegen meist Batterie und Bordwerkzeug." },
  heckverkleidung: { funktion: "Verkleidet das Heck und trägt das Rücklicht.", material: "Kunststoff, lackiert", gewicht: "ca. 1 kg", ausbau: "Schrauben und Clips lösen.", wissen: "Spitze Hecks sorgen für weniger Luftwirbel." },
  ritzel: { funktion: "Kleines Kettenrad am Getriebe – treibt die Kette an.", material: "Stahl, gehärtet", gewicht: "ca. 200 g", ausbau: "Ritzeldeckel ab, Mutter lösen (Gang einlegen zum Gegenhalten).", wissen: "Ein Zahn weniger am Ritzel = spürbar mehr Beschleunigung." },
  kettenrad: { funktion: "Großes Zahnrad am Hinterrad.", material: "Aluminium oder Stahl", gewicht: "ca. 700 g", ausbau: "Hinterrad ausbauen, Schrauben am Kettenradträger lösen.", wissen: "Kette, Ritzel und Kettenrad tauscht man immer zusammen." },
  kette: { funktion: "Überträgt die Kraft vom Getriebe aufs Hinterrad.", material: "Stahl mit O-Ringen", gewicht: "ca. 2 kg", ausbau: "Mit Kettentrenner am Nietschloss öffnen.", werkzeug: "Kettentrenner und -nieter", wissen: "Alle 500–1.000 km schmieren, sonst verschleißt sie schnell." },
  schwinge: { funktion: "Hält das Hinterrad und schwingt beim Federn um einen Drehpunkt.", material: "Aluminium", gewicht: "ca. 5 kg", ausbau: "Hinterrad und Federbein ab, Schwingenachse herausziehen.", wissen: "Einarmschwingen sehen spektakulär aus und erleichtern den Radwechsel." },
  // Triebwerk
  gondel: { funktion: "Die äußere Verkleidung des Triebwerks: führt die Luft und dämpft Lärm.", material: "Kohlefaser, Aluminium", gewicht: "ca. 800 kg", ausbau: "Die Hälften lassen sich am Flugzeug aufklappen wie eine Muschel.", wissen: "Innen sind Schalldämpfer-Waben eingebaut." },
  spinner: { funktion: "Die Spitze vorne: lenkt die Luft sauber auf die Fan-Schaufeln.", material: "Kohlefaser", gewicht: "ca. 15 kg", ausbau: "Schrauben lösen, abnehmen.", wissen: "Die Spirale darauf zeigt dem Bodenpersonal, dass das Triebwerk dreht." },
  fan: { funktion: "Das große Gebläse vorne – erzeugt rund 80–90 % des Schubs.", material: "Titan oder Kohlefaser", gewicht: "ca. 500 kg", ausbau: "Jede Schaufel einzeln aus der Nabe ziehen.", wissen: "Die Schaufelspitzen erreichen fast Schallgeschwindigkeit." },
  leitschaufeln: { funktion: "Feste Schaufeln hinter dem Fan: richten den Luftstrom wieder gerade aus.", material: "Aluminium, Verbundstoff", gewicht: "ca. 150 kg", ausbau: "Nur in der Werft.", wissen: "Ohne sie würde der Luftstrom verwirbelt und Schub verloren gehen." },
  kerngehaeuse: { funktion: "Umschließt den Kern: Verdichter, Brennkammer, Turbine.", material: "Titan, Nickel-Legierungen", gewicht: "ca. 600 kg", ausbau: "Triebwerk in der Werft in Module zerlegen.", wissen: "Nur ca. 1/10 der Luft geht durch den Kern, der Rest am Kern vorbei (Mantelstrom)." },
  nd_verdichter: { funktion: "Niederdruckverdichter („Booster“): presst die Kernluft zum ersten Mal zusammen.", material: "Titan", gewicht: "ca. 120 kg", ausbau: "Modulweise in der Werft.", wissen: "Er dreht gemeinsam mit dem Fan." },
  hd_verdichter: { funktion: "Hochdruckverdichter: viele kleine Schaufelräder pressen die Luft auf das 40-fache zusammen.", material: "Titan, Nickel-Legierung", gewicht: "ca. 250 kg", ausbau: "Modulweise in der Werft.", wissen: "Die Luft wird dabei über 600 °C heiß – nur durch Zusammendrücken." },
  brennkammer: { funktion: "Hier wird Kerosin eingespritzt und verbrannt – die heiße Luft dehnt sich gewaltig aus.", material: "Nickel-Superlegierung mit Keramik-Schicht", gewicht: "ca. 100 kg", ausbau: "Nur in der Werft.", wissen: "Die Flamme ist ca. 2.000 °C heiß – heißer als das Metall aushalten würde. Kühlluft schützt es." },
  hd_turbine: { funktion: "Hochdruckturbine: nimmt Energie aus dem heißen Gas und treibt den Hochdruckverdichter an.", material: "Einkristall-Nickel-Legierung", gewicht: "ca. 150 kg", ausbau: "Modulweise in der Werft.", wissen: "Jede Schaufel ist aus einem einzigen Metallkristall gegossen und hat innen Kühlkanäle." },
  nd_turbine: { funktion: "Niederdruckturbine: treibt über die lange Welle den Fan an.", material: "Nickel-Legierung", gewicht: "ca. 400 kg", ausbau: "Modulweise in der Werft.", wissen: "Sie hat mehrere Stufen, weil das Gas hier schon kühler ist." },
  nd_welle: { funktion: "Die innere, lange Welle: verbindet Niederdruckturbine und Fan.", material: "Hochfester Stahl", gewicht: "ca. 100 kg", ausbau: "Nur in der Werft.", wissen: "Die beiden Wellen drehen ineinander und unabhängig voneinander." },
  hd_welle: { funktion: "Die äußere, kurze Welle: verbindet Hochdruckturbine und Hochdruckverdichter.", material: "Titan, Nickel-Legierung", gewicht: "ca. 60 kg", ausbau: "Nur in der Werft.", wissen: "Sie dreht etwa dreimal so schnell wie der Fan." },
  schubduese: { funktion: "Formt den heißen Abgasstrahl am Ende.", material: "Nickel-Legierung", gewicht: "ca. 80 kg", ausbau: "Flansch lösen.", wissen: "Das Abgas strömt mit ca. 400 m/s heraus." },
  abgaskegel: { funktion: "Der Kegel in der Düse sorgt für einen gleichmäßigen Abgasstrahl.", material: "Titan oder Keramik-Verbund", gewicht: "ca. 30 kg", ausbau: "Schrauben lösen.", wissen: "Er heißt auf Englisch „Plug“." },
  zubehoergetriebe: { funktion: "Treibt Pumpen, Generator und Starter an – direkt vom Triebwerk.", material: "Aluminium-Gehäuse, Zahnräder", gewicht: "ca. 120 kg", ausbau: "Anbauteile ab, Getriebe abschrauben.", wissen: "Hier sitzt auch der Generator für den Bordstrom." },
  pylon: { funktion: "Der Träger, der das Triebwerk am Flügel hält.", material: "Titan", gewicht: "ca. 400 kg", ausbau: "Triebwerk mit Spezialgestell absenken – in ca. 4 Stunden möglich.", wissen: "Seine Sollbruchstellen lassen das Triebwerk im Notfall abbrechen, bevor der Flügel reißt." },
  // Schaltgetriebe
  getriebegehaeuse: { funktion: "Hält alle Wellen und Lager und ist mit Getriebeöl gefüllt.", material: "Aluminium-Guss", gewicht: "ca. 15 kg", ausbau: "Öl ablassen, Gehäusehälften trennen.", wissen: "Hier durchsichtig gezeigt, damit du die Zahnräder siehst." },
  eingangswelle: { funktion: "Kommt von der Kupplung und dreht mit Motordrehzahl.", material: "Stahl, gehärtet", gewicht: "ca. 2 kg", ausbau: "Gehäuse öffnen, Lager abziehen.", wissen: "Bei getretener Kupplung steht sie still." },
  hauptwelle: { funktion: "Die Abtriebswelle: geht zu Kardanwelle bzw. Differenzial.", material: "Stahl, gehärtet", gewicht: "ca. 4 kg", ausbau: "Gehäuse öffnen, Zahnräder und Muffen abziehen.", wissen: "Die Gang-Zahnräder drehen sich frei auf ihr – erst die Schaltmuffe verbindet sie fest." },
  vorgelegewelle: { funktion: "Läuft parallel unten und treibt alle Gang-Zahnräder gleichzeitig an.", material: "Stahl", gewicht: "ca. 4 kg", ausbau: "Nach der Hauptwelle ausbauen.", wissen: "Alle Zahnräder sind ständig im Eingriff – deshalb heißt es „Synchrongetriebe“." },
  zahnrad_konstante: { funktion: "Das Konstanten-Zahnradpaar verbindet Eingangswelle und Vorgelegewelle dauerhaft.", material: "Stahl, schräg verzahnt", gewicht: "ca. 1,5 kg", ausbau: "Mit der Welle ausbauen.", wissen: "Schräge Zähne laufen leiser als gerade." },
  zahnrad_gang: { funktion: "Ein Gang-Zahnrad. Klein auf der Vorgelegewelle + groß auf der Hauptwelle = kleiner Gang mit viel Kraft.", material: "Stahl, gehärtet und geschliffen", gewicht: "ca. 1–2 kg", ausbau: "Sicherungsring lösen, Rad von der Welle ziehen.", wissen: "Im 1. Gang dreht die Hauptwelle ca. 3,5-mal langsamer als der Motor." },
  rueckwaertsrad: { funktion: "Ein Zwischenrad dreht die Drehrichtung um – so fährst du rückwärts.", material: "Stahl, gerade verzahnt", gewicht: "ca. 0,8 kg", ausbau: "Achse herausziehen.", wissen: "Gerade Zähne sind der Grund, warum der Rückwärtsgang so heult." },
  schaltmuffe: { funktion: "Schiebt sich auf ein Zahnrad und verbindet es fest mit der Welle – das ist „Schalten“.", material: "Stahl mit Messing-Synchronring", gewicht: "ca. 0,5 kg", ausbau: "Mit der Hauptwelle.", wissen: "Der Synchronring gleicht die Drehzahl an, damit es nicht kracht." },
  schaltgabel: { funktion: "Greift in die Schaltmuffe und schiebt sie hin und her.", material: "Stahl oder Messing", gewicht: "ca. 300 g", ausbau: "Schaltstange herausziehen.", wissen: "Dein Schalthebel bewegt am Ende nur diese Gabeln." },
  schaltstange: { funktion: "Führt die Schaltgabeln und verbindet sie mit dem Schalthebel.", material: "Stahl", gewicht: "ca. 400 g", ausbau: "Arretierung lösen, herausziehen.", wissen: "Kugel-Rasten halten den Gang fest, damit er nicht herausspringt." },
  kupplungsscheibe: { funktion: "Wird zwischen Schwungrad und Druckplatte gepresst und überträgt so die Kraft.", material: "Stahl mit Reibbelag", gewicht: "ca. 2 kg", ausbau: "Getriebe ab, Druckplatte lösen, Scheibe abnehmen.", wissen: "Der Belag verschleißt – eine Kupplung hält ca. 150.000 km." },
  druckplatte: { funktion: "Presst mit einer Tellerfeder die Kupplungsscheibe ans Schwungrad.", material: "Stahl", gewicht: "ca. 4 kg", ausbau: "Schrauben über Kreuz lösen.", wissen: "Beim Treten des Pedals wird die Feder entlastet – die Kraft ist getrennt." },
  abtriebsflansch: { funktion: "Hier wird die Kardanwelle angeschraubt.", material: "Stahl", gewicht: "ca. 1 kg", ausbau: "Mutter lösen, abziehen.", wissen: "Eine Gummi-Hardyscheibe dazwischen dämpft Schläge." },
  // Gaming-PC
  pc_gehaeuse: { funktion: "Hält alle Teile, führt die Luft und schützt vor Staub.", material: "Stahl, Aluminium", gewicht: "ca. 8 kg", ausbau: "Alle Komponenten herausnehmen – das Gehäuse bleibt übrig.", wissen: "Gute Gehäuse haben vorne Staubfilter." },
  seitenteil: { funktion: "Glasscheibe an der Seite – zeigt die Technik und die RGB-Beleuchtung.", material: "Gehärtetes Glas", gewicht: "ca. 2 kg", ausbau: "Rändelschrauben hinten lösen, Scheibe abnehmen.", wissen: "Hier durchsichtig gezeigt – Röntgen aus zeigt es wie in echt." },
  mainboard: { funktion: "Die Hauptplatine: verbindet CPU, Arbeitsspeicher, Grafikkarte und Speicher.", material: "Leiterplatte mit Kupferbahnen", gewicht: "ca. 1,2 kg", ausbau: "Alle Karten und Kabel ab, 9 Schrauben lösen.", werkzeug: "Kreuzschlitz PH2", wissen: "Ein Mainboard hat bis zu 14 Schichten Leiterbahnen übereinander." },
  cpu: { funktion: "Der Prozessor – das Gehirn des PCs, rechnet Milliarden Befehle pro Sekunde.", material: "Silizium-Chip unter Metalldeckel", gewicht: "ca. 50 g", ausbau: "Kühler ab, Sockelhebel öffnen, CPU senkrecht herausheben.", wissen: "Auf einem CPU-Chip sitzen über 20 Milliarden Transistoren." },
  cpu_kuehler: { funktion: "Führt die Wärme der CPU über Heatpipes in Kühlrippen ab.", material: "Kupfer, Aluminium-Lamellen", gewicht: "ca. 1 kg", ausbau: "Lüfter ab, vier Schrauben über Kreuz lösen. Wärmeleitpaste erneuern!", wissen: "Heatpipes leiten Wärme 100-mal besser als massives Kupfer." },
  cpu_luefter: { funktion: "Bläst Luft durch die Kühlrippen.", material: "Kunststoff, Elektromotor", gewicht: "ca. 150 g", ausbau: "Klammern lösen, Stecker ab.", wissen: "Er dreht je nach Last zwischen 300 und 2.000 U/min." },
  ram: { funktion: "Arbeitsspeicher: Kurzzeitgedächtnis für laufende Programme.", material: "Leiterplatte mit Speicherchips, Alu-Kühlblech", gewicht: "ca. 40 g", ausbau: "Riegel an den Enden öffnen, Modul herausziehen.", wissen: "Alles im RAM ist weg, sobald der Strom aus ist." },
  gpu: { funktion: "Die Grafikkarte berechnet Bilder für Spiele und KI – Tausende Rechenkerne parallel.", material: "Leiterplatte, Grafikchip, Kühlkörper", gewicht: "ca. 1,5–2 kg", ausbau: "Stromstecker ab, Slotschraube lösen, PCIe-Riegel drücken, Karte herausziehen.", wissen: "Eine Top-Grafikkarte hat über 16.000 Rechenkerne." },
  gpu_luefter: { funktion: "Kühlen den Grafikchip, stehen im Leerlauf oft still.", material: "Kunststoff", gewicht: "ca. 50 g", ausbau: "Kühler-Abdeckung abschrauben.", wissen: "„Zero-Fan“: Unter 50 °C bleiben sie ganz stehen." },
  netzteil: { funktion: "Macht aus 230 Volt die 12, 5 und 3,3 Volt, die der PC braucht.", material: "Elektronik im Stahlgehäuse", gewicht: "ca. 2 kg", ausbau: "Alle Kabel ab, vier Schrauben hinten lösen.", wissen: "Niemals öffnen – die Kondensatoren bleiben lange geladen." },
  ssd: { funktion: "Superschneller Speicher für System und Spiele (M.2-Steckkarte).", material: "Leiterplatte mit Flash-Chips", gewicht: "ca. 8 g", ausbau: "Eine kleine Schraube lösen, Karte schräg herausziehen.", wissen: "Liest bis zu 7.000 MB pro Sekunde – 50-mal schneller als eine Festplatte." },
  hdd: { funktion: "Klassische Festplatte für viele Daten (Fotos, Videos).", material: "Alu-Gehäuse, Magnetscheiben", gewicht: "ca. 700 g", ausbau: "SATA-Kabel ab, Schienen herausziehen.", wissen: "Die Scheiben drehen mit 7.200 U/min, der Lesekopf schwebt 3 Nanometer darüber." },
  gehaeuseluefter: { funktion: "Saugt vorne kühle Luft an und bläst hinten warme hinaus.", material: "Kunststoff, RGB-LEDs", gewicht: "ca. 150 g", ausbau: "Vier Schrauben lösen.", wissen: "Vorne rein, hinten und oben raus – so fließt die Luft am besten." },
  stromkabel: { funktion: "Versorgt Mainboard, CPU und Grafikkarte mit Strom.", material: "Kupfer, gesleevte Isolierung", gewicht: "ca. 300 g", ausbau: "Stecker entriegeln und abziehen.", wissen: "Der 24-polige Mainboard-Stecker ist der größte im PC." },
};

// ---------- Kleine Baukasten-Helfer ----------
function baukasten() {
  const teile = [];
  const n = {};
  const t = (gruppe, art, name, form, opts = {}) => {
    const base = `${gruppe}-${art}`;
    n[base] = (n[base] || 0) + 1;
    const teil = { id: `${base}-${n[base]}`, art, name, gruppe, form, ...opts };
    if (teil.pos) teil.pos = v3(teil.pos);
    teile.push(teil);
    return teil;
  };
  return { teile, t };
}

// ---------- Ein V8-Motor (längs eingebaut, Kurbelwelle entlang x, vorne = +x) ----------
function v8(t, { x0 = 0, yc = 0.33, z0 = 0, gruppe = "motor", detail = false, farbe = "#ff7a1a" } = {}) {
  const pinWinkel = [0, PI / 2, (3 * PI) / 2, PI]; // Crossplane-Kurbelwelle
  const pt = (s, a) => [x0, yc + C45 * a, z0 + s * C45 * a];
  t(gruppe, "motorblock", "Motorblock (Kurbelgehäuse)", "box", { g: [0.56, 0.22, 0.34], rund: 0.02, pos: [x0, yc + 0.02, z0], mat: "alu", farbe: "#a3a8ad" });
  t(gruppe, "oelwanne", "Ölwanne", "box", { g: [0.5, 0.11, 0.27], rund: 0.02, pos: [x0, yc - 0.15, z0], mat: "alu", farbe: "#3d4146", explo: [0, -0.35, 0] });
  t(gruppe, "kurbelwelle", "Kurbelwelle", "kurbelwelle", { laenge: 0.56, r: 0.028, kroepfungen: 4, hub: 0.043, achse: "x", pos: [x0, yc, z0], mat: "stahl", anim: { art: "drehen", achse: "x", tempo: 1 }, explo: [0, -0.15, 0] });
  for (const s of [1, -1]) {
    const seite = s > 0 ? "rechts" : "links";
    const rot = [s * PI / 4, 0, 0];
    const dx = s > 0 ? 0.022 : -0.022;
    t(gruppe, "zylinderbank", `Zylinderbank ${seite}`, "box", { g: [0.5, 0.2, 0.17], rund: 0.015, pos: [x0 + dx, ...pt(s, 0.2).slice(1)], rot, mat: "alu", farbe: "#b3b8bd", explo: [0, 0.2, s * 0.2] });
    t(gruppe, "zylinderkopf", `Zylinderkopf ${seite}`, "box", { g: [0.5, 0.09, 0.21], rund: 0.015, pos: [x0 + dx, ...pt(s, 0.345).slice(1)], rot, mat: "alu", farbe: "#9aa0a6", explo: [0, 0.35, s * 0.35] });
    t(gruppe, "ventildeckel", `Ventildeckel ${seite}`, "box", { g: [0.48, 0.045, 0.18], rund: 0.02, pos: [x0 + dx, ...pt(s, 0.41).slice(1)], rot, mat: "lack", farbe, explo: [0, 0.5, s * 0.5] });
    const krA = pt(s, 0.27);
    t(gruppe, "kruemmer", `Abgaskrümmer ${seite}`, "rohr", { punkte: [[x0 + 0.12, krA[1] - 0.08, s * 0.31], [x0, krA[1] - 0.12, s * 0.37], [x0 - 0.2, yc + 0.06, s * 0.38], [x0 - 0.28, yc + 0.05, s * 0.37]].map(v3), d: 0.045, mat: "stahl", farbe: "#8a6c55", explo: [0, 0, s * 0.35] });
    t(gruppe, "turbo_gehaeuse", `Turbolader ${seite} (Gehäuse)`, "torus", { r: 0.055, dicke: 0.03, achse: "x", pos: [x0 - 0.33, yc + 0.05, s * 0.37], mat: "guss", explo: [-0.1, 0, s * 0.5] });
    t(gruppe, "turbo_rad", `Turbolader ${seite} (Verdichterrad)`, "luefter", { r: 0.045, nabe: 0.012, schaufeln: 11, tiefe: 0.03, drall: 0.6, achse: "x", pos: [x0 - 0.33, yc + 0.05, s * 0.37], mat: "alu", farbe: "#d0d4d8", anim: { art: "drehen", achse: "x", tempo: 9 }, explo: [-0.1, 0, s * 0.6] });
    for (let k = 0; k < 4; k++) {
      const x = x0 + 0.15 - k * 0.1 + dx;
      const phase = pinWinkel[k] + (s > 0 ? 0 : PI / 2);
      const nr = s > 0 ? k * 2 + 1 : k * 2 + 2;
      t(gruppe, "kolben", `Kolben ${nr}`, "zyl", { r: 0.044, h: 0.065, achse: "y", pos: [x, ...pt(s, 0.16).slice(1)], rot, mat: "alu", farbe: "#d9dde1", anim: { art: "hub", richtung: [0, C45, s * C45], hub: 0.043, phase }, explo: [0, C45 * 0.55, s * C45 * 0.55] });
      t(gruppe, "pleuel", `Pleuel ${nr}`, "box", { g: [0.024, 0.14, 0.04], pos: [x, ...pt(s, 0.085).slice(1)], rot, mat: "stahl", anim: { art: "hub", richtung: [0, C45, s * C45], hub: 0.03, phase }, explo: [0, C45 * 0.4, s * C45 * 0.4] });
      t(gruppe, "zuendspule", `Zündspule ${nr}`, "box", { g: [0.03, 0.06, 0.03], pos: [x, ...pt(s, 0.455).slice(1)], rot, mat: "kunststoff", farbe: "#1b1d21", explo: [0, 0.6, s * 0.6] });
      if (detail) {
        const kopf = pt(s, 0.31);
        const quer = [0, -s * C45, C45];
        for (const [i, off] of [[0, -0.022], [1, 0.022]]) {
          t(gruppe, "ventil", `${i ? "Auslass" : "Einlass"}ventil Zyl. ${nr}`, "zyl", { r: 0.009, r2: 0.017, h: 0.075, achse: "y", pos: [x, kopf[1] + quer[1] * off, kopf[2] + quer[2] * off], rot, mat: "stahl", anim: { art: "hub", richtung: [0, -C45, -s * C45], hub: 0.004, phase: phase * 2 + i * PI }, explo: [0, C45 * 0.4, s * C45 * 0.4] });
        }
        const zk = pt(s, 0.36);
        t(gruppe, "zuendkerze", `Zündkerze ${nr}`, "zyl", { r: 0.008, h: 0.085, achse: "y", pos: [x, zk[1], zk[2]], rot, mat: "kunststoff", farbe: "#f2f2ee", explo: [0, C45 * 0.7, s * C45 * 0.7] });
      }
    }
    if (detail) {
      const kopf = pt(s, 0.37);
      const quer = [0, -s * C45, C45];
      for (const [i, off] of [[0, -0.045], [1, 0.045]]) {
        t(gruppe, "nockenwelle", `${i ? "Auslass" : "Einlass"}-Nockenwelle ${seite}`, "zyl", { r: 0.014, h: 0.52, achse: "x", pos: [x0 + dx, kopf[1] + quer[1] * off, kopf[2] + quer[2] * off], mat: "stahl", anim: { art: "drehen", achse: "x", tempo: 0.5 }, explo: [0, 0.42, s * 0.42] });
      }
    }
  }
  t(gruppe, "ansaugbruecke", "Ansaugbrücke", "box", { g: [0.44, 0.07, 0.15], rund: 0.02, pos: [x0, yc + 0.36, z0], mat: "carbon", explo: [0, 0.6, 0] });
  t(gruppe, "drosselklappe", "Drosselklappe", "zyl", { r: 0.04, h: 0.07, achse: "x", pos: [x0 + 0.26, yc + 0.36, z0], mat: "alu", explo: [0.3, 0.55, 0] });
  t(gruppe, "riemenscheibe", "Riemenscheibe", "zyl", { r: 0.075, h: 0.03, achse: "x", pos: [x0 + 0.3, yc, z0], mat: "stahl", anim: { art: "drehen", achse: "x", tempo: 1 }, explo: [0.35, 0, 0] });
  t(gruppe, "lichtmaschine", "Lichtmaschine", "zyl", { r: 0.06, h: 0.11, achse: "x", pos: [x0 + 0.3, yc + 0.17, z0 + 0.2], mat: "alu", farbe: "#c3c7cb", anim: { art: "drehen", achse: "x", tempo: 2.5 }, explo: [0.35, 0.1, 0.25] });
  t(gruppe, "wasserpumpe", "Wasserpumpe", "zyl", { r: 0.05, h: 0.05, achse: "x", pos: [x0 + 0.3, yc + 0.13, z0 - 0.12], mat: "alu", anim: { art: "drehen", achse: "x", tempo: 1.2 }, explo: [0.35, 0.1, -0.25] });
  t(gruppe, "oelfilter", "Ölfilter", "zyl", { r: 0.04, h: 0.1, achse: "z", pos: [x0 - 0.05, yc - 0.06, z0 - 0.21], mat: "lack", farbe: "#1d4fa8", explo: [0, -0.1, -0.35] });
  t(gruppe, "schwungrad", "Schwungrad", "zyl", { r: 0.15, h: 0.03, achse: "x", pos: [x0 - 0.3, yc, z0], mat: "stahl", anim: { art: "drehen", achse: "x", tempo: 1 }, explo: [-0.4, 0, 0] });
  if (detail) {
    const a = pt(1, 0.37), b = pt(-1, 0.37);
    t(gruppe, "steuerkette", "Steuerkette", "rohr", { punkte: [[x0 + 0.27, yc - 0.03, z0], [x0 + 0.27, a[1], a[2] + 0.03], [x0 + 0.27, a[1] + 0.04, a[2] - 0.03], [x0 + 0.27, yc + 0.12, z0], [x0 + 0.27, b[1] + 0.04, b[2] + 0.03], [x0 + 0.27, b[1], b[2] - 0.03], [x0 + 0.27, yc - 0.03, z0]].map(v3), d: 0.012, mat: "stahl", explo: [0.25, 0.1, 0] });
  }
}

// ---------- Räder, Bremsen, Federung, Lenkung (Auto entlang x, vorne = +x) ----------
function fahrwerk(t, { xF, xH, r, B, bv = 0.255, bh = 0.295, sattel = "#ff7a1a", feder = "#ffd84d" }) {
  for (const [x, b, vorne] of [[xF, bv, true], [xH, bh, false]]) {
    for (const s of [-1, 1]) {
      const z = s * (B / 2 - b / 2 - 0.035);
      const lage = `${vorne ? "vorne" : "hinten"} ${s < 0 ? "links" : "rechts"}`;
      t("fahrwerk", "rad", `Rad ${lage}`, "rad", { r, breite: b, seite: s, achse: "z", pos: [x, r, z], anim: { art: "drehen", achse: "z", tempo: -1 }, explo: [0, 0, s * 0.7] });
      t("fahrwerk", "bremsscheibe", `Bremsscheibe ${lage}`, "zyl", { r: vorne ? 0.19 : 0.18, h: 0.032, achse: "z", pos: [x, r, z - s * (b / 2 - 0.08)], mat: "guss", farbe: "#5a5e63", gelocht: true, anim: { art: "drehen", achse: "z", tempo: -1 }, explo: [0, 0, s * 0.45] });
      t("fahrwerk", "bremssattel", `Bremssattel ${lage}`, "box", { g: [0.11, 0.17, 0.07], rund: 0.02, pos: [x + (vorne ? 0.12 : -0.12), r + 0.11, z - s * (b / 2 - 0.08)], rot: [0, 0, vorne ? -0.6 : 0.6], mat: "lack", farbe: sattel, explo: [vorne ? 0.15 : -0.15, 0.15, s * 0.5] });
      t("fahrwerk", "feder", `Feder ${lage}`, "feder", { r: 0.05, h: 0.3, windungen: 6, d: 0.012, pos: [x - 0.04 * (vorne ? 1 : -1), r + 0.3, s * (B / 2 - b - 0.12)], mat: "lack", farbe: feder, explo: [0, 0.35, s * 0.3] });
      t("fahrwerk", "daempfer", `Stoßdämpfer ${lage}`, "zyl", { r: 0.02, h: 0.42, achse: "y", pos: [x - 0.04 * (vorne ? 1 : -1), r + 0.3, s * (B / 2 - b - 0.12)], mat: "chrom", explo: [0, 0.35, s * 0.3] });
      t("fahrwerk", "querlenker", `Querlenker ${lage}`, "box", { g: [0.28, 0.03, B / 2 - b - 0.12], rund: 0.01, pos: [x, r - 0.12, s * ((B / 2 - b - 0.12) / 2 + 0.06)], mat: "alu", explo: [0, -0.2, s * 0.25] });
    }
  }
  t("fahrwerk", "lenkgetriebe", "Lenkgetriebe (Zahnstange)", "zyl", { r: 0.03, h: B - 0.75, achse: "z", pos: [xF + 0.14, r - 0.06, 0], mat: "alu", explo: [0.3, -0.15, 0] });
}

// ---------- Modell 1: Sportwagen mit V8 ----------
function sportwagen() {
  const { teile, t } = baukasten();
  const L = 4.55, H = 1.25, B = 1.95, R = 2.7, r = 0.35;
  const xF = L / 2 - (L - R) * 0.45, xH = xF - R;
  t("karosserie", "karosserie", "Karosserie (Coupé)", "auto", { spec: { karosserie: "coupe", laenge: L, hoehe: H, breite: B, radstand: R, rad: r, ps: 600, felge: "#3c4047", bremse: "#ff7a1a" }, farbe: "#ff6a14", explo: [0, 1.4, 0] });
  v8(t, { x0: 1.1, yc: 0.33, z0: 0 });
  // Kühlung
  t("kuehlung", "kuehler", "Wasserkühler", "box", { g: [0.06, 0.4, 0.78], pos: [1.98, 0.42, 0], mat: "alu", farbe: "#8b9096", lamellen: true, explo: [0.5, 0, 0] });
  t("kuehlung", "luefter", "Kühlerlüfter", "luefter", { r: 0.17, nabe: 0.05, schaufeln: 7, tiefe: 0.05, drall: 0.5, achse: "x", pos: [1.9, 0.42, 0], mat: "kunststoff", farbe: "#202226", anim: { art: "drehen", achse: "x", tempo: 3 }, explo: [0.35, 0, 0] });
  t("kuehlung", "kuehlschlauch", "Kühlwasserschlauch oben", "rohr", { punkte: [[1.95, 0.58, 0.25], [1.7, 0.62, 0.22], [1.45, 0.55, 0.12]], d: 0.04, mat: "gummi", explo: [0.4, 0.2, 0.2] });
  t("kuehlung", "kuehlschlauch", "Kühlwasserschlauch unten", "rohr", { punkte: [[1.95, 0.26, -0.25], [1.7, 0.22, -0.22], [1.45, 0.3, -0.12]], d: 0.04, mat: "gummi", explo: [0.4, -0.1, -0.2] });
  // Antrieb
  t("antrieb", "getriebe", "8-Gang-Getriebe", "box", { g: [0.5, 0.24, 0.24], rund: 0.05, pos: [0.55, 0.32, 0], mat: "alu", farbe: "#7d838a", explo: [0, -0.1, 0] });
  t("antrieb", "kardanwelle", "Kardanwelle", "zyl", { r: 0.035, h: 1.42, achse: "x", pos: [-0.42, 0.3, 0], mat: "carbon", anim: { art: "drehen", achse: "x", tempo: 2.5 }, explo: [0, -0.25, 0] });
  t("antrieb", "differenzial", "Hinterachs-Differenzial", "kugel", { r: 0.14, skala: [1, 0.9, 1.1], pos: [xH, r, 0], mat: "guss", explo: [-0.3, -0.1, 0] });
  for (const s of [-1, 1]) t("antrieb", "antriebswelle", `Antriebswelle hinten ${s < 0 ? "links" : "rechts"}`, "zyl", { r: 0.025, h: 0.52, achse: "z", pos: [xH, r, s * 0.38], mat: "stahl", anim: { art: "drehen", achse: "z", tempo: -1 }, explo: [0, 0, s * 0.35] });
  // Abgas
  for (const s of [-1, 1]) {
    const seite = s < 0 ? "links" : "rechts";
    t("abgas", "abgasrohr", `Abgasrohr ${seite}`, "rohr", { punkte: [[0.75, 0.38, s * 0.37], [0.55, 0.15, s * 0.3], [0.15, 0.14, s * 0.26]], d: 0.06, mat: "stahl", explo: [0, -0.3, s * 0.3] });
    t("abgas", "katalysator", `Katalysator ${seite}`, "zyl", { r: 0.07, h: 0.36, achse: "x", pos: [-0.04, 0.14, s * 0.26], mat: "stahl", farbe: "#b9bdc1", explo: [0, -0.35, s * 0.35] });
    t("abgas", "abgasrohr", `Mittelrohr ${seite}`, "rohr", { punkte: [[-0.22, 0.14, s * 0.26], [-0.9, 0.15, s * 0.2], [-1.55, 0.2, s * 0.35]], d: 0.06, mat: "stahl", explo: [0, -0.35, s * 0.3] });
  }
  t("abgas", "endtopf", "Endschalldämpfer", "box", { g: [0.3, 0.17, 1.0], rund: 0.06, pos: [-1.85, 0.25, 0], mat: "stahl", farbe: "#9da2a7", explo: [-0.5, -0.1, 0] });
  const boden = 0.12, X = (u) => -L / 2 + u * L;
  for (const z of [-0.6045, -0.4875, 0.4875, 0.6045]) t("abgas", "endrohr", "Endrohr", "zyl", { r: 0.045, h: 0.14, achse: "x", pos: [X(0.012) + 0.02, boden + 0.12, z], mat: "chrom", explo: [-0.8, 0, z * 0.3] });
  // Kraftstoff
  t("kraftstoff", "tank", "Kraftstofftank (70 l)", "box", { g: [0.42, 0.24, 0.92], rund: 0.06, pos: [-0.78, 0.32, 0], mat: "kunststoff", farbe: "#2a2c30", explo: [0, -0.4, 0] });
  t("kraftstoff", "kraftstoffleitung", "Kraftstoffleitung", "rohr", { punkte: [[-0.6, 0.25, 0.4], [0.2, 0.22, 0.45], [0.9, 0.55, 0.25]], d: 0.015, mat: "stahl", explo: [0, -0.3, 0.3] });
  // Fahrwerk
  fahrwerk(t, { xF, xH, r, B });
  // Innenraum
  for (const s of [-1, 1]) t("innenraum", "sitz", s < 0 ? "Fahrersitz" : "Beifahrersitz", "sitz", { breite: 0.52, pos: [0.08, 0.2, s * 0.37], mat: "leder", farbe: "#1c1d20", akzent: "#ff7a1a", explo: [0, 0.55, s * 0.35] });
  t("innenraum", "lenkrad", "Lenkrad", "torus", { r: 0.18, dicke: 0.02, achse: "x", rot: [0, 0, -0.35], pos: [0.52, 0.74, -0.37], mat: "leder", farbe: "#141518", speichen: 3, explo: [-0.2, 0.5, -0.3] });
  t("innenraum", "lenksaeule", "Lenksäule", "rohr", { punkte: [[0.55, 0.73, -0.37], [0.8, 0.62, -0.37], [1.0, 0.4, -0.3], [xF + 0.14, 0.3, -0.25]].map(v3), d: 0.035, mat: "stahl", explo: [0, 0.4, -0.3] });
  t("innenraum", "armaturenbrett", "Armaturenbrett", "box", { g: [0.28, 0.18, 1.6], rund: 0.06, pos: [0.82, 0.7, 0], mat: "kunststoff", farbe: "#17181b", explo: [0.15, 0.6, 0] });
  t("innenraum", "mittelkonsole", "Mittelkonsole", "box", { g: [0.75, 0.2, 0.22], rund: 0.04, pos: [0.34, 0.33, 0], mat: "leder", farbe: "#1c1d20", explo: [0, 0.45, 0] });
  t("innenraum", "schalthebel", "Wählhebel", "zyl", { r: 0.018, r2: 0.03, h: 0.12, achse: "y", pos: [0.4, 0.48, 0], mat: "alu", explo: [0, 0.6, 0] });
  // Elektrik
  t("elektrik", "batterie", "12-V-Batterie", "box", { g: [0.28, 0.19, 0.18], rund: 0.01, pos: [1.68, 0.5, 0.6], mat: "kunststoff", farbe: "#202226", explo: [0.2, 0.5, 0.3] });
  t("elektrik", "steuergeraet", "Motorsteuergerät", "box", { g: [0.2, 0.04, 0.15], rund: 0.005, pos: [1.65, 0.6, -0.6], mat: "alu", explo: [0.2, 0.5, -0.3] });
  t("elektrik", "kabelbaum", "Kabelbaum", "rohr", { punkte: [[1.68, 0.62, 0.6], [1.5, 0.66, 0.45], [1.3, 0.68, 0], [1.5, 0.66, -0.45], [1.65, 0.64, -0.6], [1.0, 0.66, -0.7], [0.5, 0.64, -0.75]], d: 0.025, mat: "kunststoff", farbe: "#111214", explo: [0.1, 0.45, 0] });
  return {
    id: "sportwagen-v8",
    name: "Sportwagen mit V8-Biturbo",
    symbol: "🏎️",
    kurz: "Front-Mittelmotor-Coupé mit 4,0-Liter-V8, zwei Turbos, Heckantrieb.",
    kamera: { dist: 7.5, ziel: [0, 0.55, 0] },
    gruppen: [
      { id: "karosserie", name: "Karosserie", symbol: "🚘", huelle: true, raus: [[0, 1.9, 0]], info: "Heb die Karosserie ab, dann siehst du den ganzen Antriebsstrang (in der Fabrik: „Hochzeit“)." },
      { id: "motor", name: "V8-Motor", symbol: "⚙️", raus: [[0, 1.6, 0], [0, 1.6, 2.4], [0, 0.35, 2.4]], braucht: ["karosserie"], info: "4,0-Liter-V8 mit zwei Turboladern. Mit dem Kran nach oben herausheben." },
      { id: "kuehlung", name: "Kühlung", symbol: "❄️", raus: [[0.9, 0, 0]], braucht: ["karosserie"] },
      { id: "antrieb", name: "Getriebe & Antrieb", symbol: "🔩", raus: [[0, -0.6, 0], [0, -0.6, -2.4], [0, 0, -2.4]] },
      { id: "abgas", name: "Abgasanlage", symbol: "💨", raus: [[0, -0.5, 0], [-1.2, -0.5, 0], [-1.2, 0, -2.2]] },
      { id: "kraftstoff", name: "Kraftstoff", symbol: "⛽", raus: [[0, -0.7, 0], [0, -0.7, -2.2]] },
      { id: "fahrwerk", name: "Räder & Fahrwerk", symbol: "🛞", raus: [[0, 0.1, 0]] },
      { id: "innenraum", name: "Innenraum", symbol: "💺", raus: [[0, 1.6, 0], [0, 1.6, -2.4], [0, 0.4, -2.4]], braucht: ["karosserie"] },
      { id: "elektrik", name: "Elektrik", symbol: "⚡", raus: [[0, 1.4, 0], [1.6, 1.4, 0]], braucht: ["karosserie"] },
    ],
    teile,
    daten: [
      { label: "Motor", wert: "4,0 l V8 Biturbo" }, { label: "Leistung", wert: "ca. 600 PS / 800 Nm" }, { label: "0–100 km/h", wert: "ca. 3,4 s" },
      { label: "Spitze", wert: "ca. 315 km/h" }, { label: "Gewicht", wert: "ca. 1.650 kg" }, { label: "Länge", wert: "4,55 m" },
    ],
  };
}

// ---------- Modell 2: Elektroauto ----------
function elektroauto() {
  const { teile, t } = baukasten();
  const L = 4.7, H = 1.44, B = 1.85, R = 2.875, r = 0.36;
  const xF = L / 2 - (L - R) * 0.46, xH = xF - R;
  t("karosserie", "karosserie", "Karosserie (Limousine)", "auto", { spec: { karosserie: "limousine", laenge: L, hoehe: H, breite: B, radstand: R, rad: r, ps: 400, felge: "#c9cdd2", bremse: "#38e1ff" }, farbe: "#2a6fdb", explo: [0, 1.5, 0] });
  // Akku
  t("akku", "akkuwanne", "Akku-Wanne", "box", { g: [2.5, 0.13, 1.5], rund: 0.03, pos: [0.07, 0.19, 0], mat: "alu", farbe: "#5d6268", explo: [0, -0.3, 0] });
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
    t("akku", "akkumodul", `Akkumodul ${i * 2 + (s < 0 ? 1 : 2)}`, "box", { g: [0.36, 0.1, 0.66], rund: 0.01, pos: [-0.98 + i * 0.41, 0.235, s * 0.355], mat: "akku", explo: [(i - 2.5) * 0.12, 0.45, s * 0.4] });
  }
  t("akku", "bms", "Batterie-Management (BMS)", "box", { g: [0.25, 0.05, 0.22], pos: [1.2, 0.26, 0], mat: "platine", explo: [0.35, 0.4, 0] });
  t("akku", "akkudeckel", "Akku-Deckel", "box", { g: [2.5, 0.02, 1.5], pos: [0.07, 0.3, 0], mat: "alu", farbe: "#8a9096", explo: [0, 0.9, 0] });
  t("akku", "hvkabel", "Hochvolt-Kabel zum Inverter", "rohr", { punkte: [[-1.15, 0.27, 0.3], [-1.3, 0.38, 0.25], [xH + 0.05, 0.52, 0.12]], d: 0.035, mat: "kunststoff", farbe: "#ff7a00", explo: [-0.2, 0.3, 0.3] });
  t("akku", "hvkabel", "Hochvolt-Kabel nach vorne", "rohr", { punkte: [[1.25, 0.27, -0.3], [1.38, 0.4, -0.3], [1.45, 0.5, -0.1]], d: 0.03, mat: "kunststoff", farbe: "#ff7a00", explo: [0.2, 0.3, -0.3] });
  // Antrieb hinten
  t("antrieb", "emotor_gehaeuse", "E-Motor (Gehäuse)", "zyl", { r: 0.16, h: 0.32, achse: "z", pos: [xH + 0.06, r, 0.14], mat: "alu", farbe: "#a9aeb3", explo: [0, 0, 0.5] });
  t("antrieb", "stator", "Stator (Kupferwicklung)", "zyl", { r: 0.135, h: 0.24, achse: "z", pos: [xH + 0.06, r, 0.14], mat: "kupfer", explo: [0, 0.35, 0.75] });
  t("antrieb", "rotor", "Rotor", "zyl", { r: 0.085, h: 0.27, achse: "z", pos: [xH + 0.06, r, 0.14], mat: "stahl", anim: { art: "drehen", achse: "z", tempo: -9 }, explo: [0, 0.6, 1.0] });
  t("antrieb", "untersetzung", "Untersetzungsgetriebe", "box", { g: [0.3, 0.32, 0.18], rund: 0.05, pos: [xH, r, -0.14], mat: "alu", farbe: "#8a9096", explo: [0, 0, -0.5] });
  t("antrieb", "inverter", "Inverter (Leistungselektronik)", "box", { g: [0.34, 0.1, 0.36], rund: 0.02, pos: [xH + 0.06, 0.58, 0.05], mat: "alu", farbe: "#c0c5ca", explo: [0, 0.5, 0] });
  for (const s of [-1, 1]) t("antrieb", "antriebswelle", `Antriebswelle ${s < 0 ? "links" : "rechts"}`, "zyl", { r: 0.025, h: 0.5, achse: "z", pos: [xH, r, s * 0.5], mat: "stahl", anim: { art: "drehen", achse: "z", tempo: -1 }, explo: [0, 0, s * 0.3] });
  // Laden
  t("laden", "ladeanschluss", "Ladeanschluss (CCS)", "box", { g: [0.06, 0.14, 0.12], rund: 0.02, pos: [-1.95, 0.82, -0.86], mat: "kunststoff", farbe: "#101114", explo: [0, 0.2, -0.6] });
  t("laden", "bordlader", "Bordlader (11 kW)", "box", { g: [0.32, 0.09, 0.26], rund: 0.02, pos: [-1.8, 0.5, 0.15], mat: "alu", explo: [-0.4, 0.4, 0] });
  t("laden", "hvkabel", "Ladekabel innen", "rohr", { punkte: [[-1.93, 0.8, -0.8], [-1.85, 0.6, -0.4], [-1.8, 0.52, 0]], d: 0.03, mat: "kunststoff", farbe: "#ff7a00", explo: [-0.3, 0.3, -0.3] });
  // Vorne
  t("vorne", "frunk", "Frunk (Kofferraum vorne)", "box", { g: [0.42, 0.26, 0.85], rund: 0.05, pos: [1.88, 0.5, 0], mat: "kunststoff", farbe: "#26282c", explo: [0.6, 0.3, 0] });
  t("vorne", "waermepumpe", "Wärmepumpe", "box", { g: [0.26, 0.2, 0.3], rund: 0.03, pos: [1.42, 0.55, 0.45], mat: "alu", explo: [0.3, 0.4, 0.3] });
  t("vorne", "kuehler", "Kühler (Akku & Motor)", "box", { g: [0.05, 0.35, 0.72], pos: [2.12, 0.42, 0], mat: "alu", farbe: "#8b9096", lamellen: true, explo: [0.6, 0, 0] });
  t("vorne", "batterie", "12-V-Batterie", "box", { g: [0.22, 0.17, 0.15], rund: 0.01, pos: [1.42, 0.52, -0.45], mat: "kunststoff", farbe: "#202226", explo: [0.3, 0.4, -0.3] });
  // Fahrwerk
  fahrwerk(t, { xF, xH, r, B, bv: 0.245, bh: 0.245, sattel: "#38e1ff", feder: "#c9cdd2" });
  // Innenraum
  for (const s of [-1, 1]) t("innenraum", "sitz", s < 0 ? "Fahrersitz" : "Beifahrersitz", "sitz", { breite: 0.52, pos: [0.25, 0.33, s * 0.38], mat: "leder", farbe: "#e8e4dc", explo: [0, 0.6, s * 0.3] });
  t("innenraum", "sitz", "Rücksitzbank", "sitz", { breite: 1.3, pos: [-0.62, 0.33, 0], mat: "leder", farbe: "#e8e4dc", explo: [-0.3, 0.6, 0] });
  t("innenraum", "lenkrad", "Lenkrad", "torus", { r: 0.18, dicke: 0.02, achse: "x", rot: [0, 0, -0.3], pos: [0.72, 0.9, -0.38], mat: "leder", farbe: "#141518", speichen: 2, explo: [-0.2, 0.5, -0.3] });
  t("innenraum", "armaturenbrett", "Armaturenbrett", "box", { g: [0.3, 0.14, 1.55], rund: 0.06, pos: [0.98, 0.85, 0], mat: "kunststoff", farbe: "#d8d4cc", explo: [0.2, 0.6, 0] });
  t("innenraum", "display", "Zentral-Display", "box", { g: [0.02, 0.2, 0.36], rund: 0.01, pos: [0.86, 1.0, 0], rot: [0, 0, 0.2], mat: "leuchte", farbe: "#38e1ff", explo: [0, 0.8, 0] });
  return {
    id: "elektroauto",
    name: "Elektroauto",
    symbol: "🔋",
    kurz: "Limousine mit 80-kWh-Akku im Boden und E-Motor an der Hinterachse.",
    kamera: { dist: 7.8, ziel: [0, 0.55, 0] },
    gruppen: [
      { id: "karosserie", name: "Karosserie", symbol: "🚘", huelle: true, raus: [[0, 2.0, 0]] },
      { id: "akku", name: "Hochvolt-Akku", symbol: "🔋", raus: [[0, -0.6, 0], [0, -0.6, 2.6], [0, 0, 2.6]], info: "Der Akku hängt unten am Auto und wird nach unten abgesenkt." },
      { id: "antrieb", name: "E-Antrieb", symbol: "⚡", raus: [[0, -0.3, 0], [-1.0, -0.3, 0], [-1.0, 0.1, -2.2]] },
      { id: "laden", name: "Laden", symbol: "🔌", raus: [[0, 1.2, 0], [-0.8, 1.2, 0]], braucht: ["karosserie"] },
      { id: "vorne", name: "Vorderwagen", symbol: "❄️", raus: [[0, 1.2, 0], [1.2, 1.2, 0]], braucht: ["karosserie"] },
      { id: "fahrwerk", name: "Räder & Fahrwerk", symbol: "🛞", raus: [[0, 0.1, 0]] },
      { id: "innenraum", name: "Innenraum", symbol: "💺", raus: [[0, 1.7, 0], [0, 1.7, -2.4], [0, 0.4, -2.4]], braucht: ["karosserie"] },
    ],
    teile,
    daten: [
      { label: "Akku", wert: "80 kWh, 400 V" }, { label: "Leistung", wert: "ca. 300 kW (408 PS)" }, { label: "Reichweite", wert: "ca. 550 km (WLTP)" },
      { label: "Schnellladen", wert: "10–80 % in ca. 25 min" }, { label: "Gewicht", wert: "ca. 2.100 kg" }, { label: "Länge", wert: "4,70 m" },
    ],
  };
}

// ---------- Modell 3: V8-Motor einzeln, mit allen Innereien ----------
function v8motor() {
  const { teile, t } = baukasten();
  v8(t, { x0: 0, yc: 0.4, z0: 0, gruppe: "block", detail: true });
  // Teile auf Baugruppen verteilen, damit man sie einzeln herausnehmen kann
  const GR = { kolben: "kurbeltrieb", pleuel: "kurbeltrieb", kurbelwelle: "kurbeltrieb", schwungrad: "kurbeltrieb",
    zylinderkopf: "kopf", ventildeckel: "kopf", nockenwelle: "ventiltrieb", ventil: "ventiltrieb", steuerkette: "ventiltrieb",
    zuendspule: "zuendung", zuendkerze: "zuendung", kruemmer: "turbo", turbo_gehaeuse: "turbo", turbo_rad: "turbo",
    ansaugbruecke: "ansaug", drosselklappe: "ansaug", lichtmaschine: "nebenaggregate", riemenscheibe: "nebenaggregate", wasserpumpe: "nebenaggregate", oelfilter: "nebenaggregate", oelwanne: "block" };
  for (const p of teile) { p.gruppe = GR[p.art] || "block"; p.id = p.id.replace(/^block-/, `${p.gruppe}-`); }
  return {
    id: "v8-motor",
    name: "V8-Motor (offen)",
    symbol: "⚙️",
    kurz: "4,0-Liter-V8 mit 32 Ventilen, Crossplane-Kurbelwelle und zwei Turbos – jedes Teil einzeln.",
    kamera: { dist: 1.9, ziel: [0, 0.48, 0] },
    gruppen: [
      { id: "zuendung", name: "Zündung", symbol: "⚡", raus: [[0, 0.55, 0]] },
      { id: "ansaug", name: "Ansaugung", symbol: "🌬️", raus: [[0, 0.6, 0], [0.5, 0.6, 0]] },
      { id: "kopf", name: "Zylinderköpfe", symbol: "🔧", raus: [[0, 0.7, 0]], braucht: ["zuendung", "ansaug"] },
      { id: "ventiltrieb", name: "Ventiltrieb", symbol: "🎛️", raus: [[0, 0.5, 0], [0, 0.5, 0.9]], braucht: ["kopf"] },
      { id: "turbo", name: "Turbos & Krümmer", symbol: "🌀", raus: [[-0.5, 0, 0]] },
      { id: "nebenaggregate", name: "Nebenaggregate", symbol: "🔋", raus: [[0.6, 0, 0]] },
      { id: "kurbeltrieb", name: "Kurbeltrieb", symbol: "⚙️", raus: [[0, -0.6, 0], [0, -0.6, -0.9]], braucht: ["kopf"], info: "Kolben, Pleuel, Kurbelwelle: hier entsteht die Drehung." },
      { id: "block", name: "Motorblock", symbol: "🧱", raus: [[0, 0, 0]] },
    ],
    teile,
    daten: [
      { label: "Hubraum", wert: "3.982 cm³" }, { label: "Bauart", wert: "V8, 90°, Crossplane" }, { label: "Ventile", wert: "32 (4 je Zylinder)" },
      { label: "Bohrung × Hub", wert: "83 × 92 mm" }, { label: "Leistung", wert: "ca. 600 PS bei 6.500 U/min" }, { label: "Gewicht", wert: "ca. 210 kg" },
    ],
  };
}

// ---------- Modell 4: Sportmotorrad ----------
function motorrad() {
  const { teile, t } = baukasten();
  const r = 0.31, xV = 0.72, xH = -0.73;
  const rake = 0.42, dir = [-Math.sin(rake), Math.cos(rake)];
  // Räder
  t("fahrwerk", "rad", "Vorderrad", "rad", { r, breite: 0.12, seite: 1, speichen: 3, achse: "z", pos: [xV, r, 0], anim: { art: "drehen", achse: "z", tempo: -1 }, explo: [0.4, 0, 0] });
  t("fahrwerk", "rad", "Hinterrad", "rad", { r, breite: 0.19, seite: 1, speichen: 3, achse: "z", pos: [xH, r, 0], anim: { art: "drehen", achse: "z", tempo: -1 }, explo: [-0.4, 0, 0] });
  for (const s of [-1, 1]) t("fahrwerk", "bremsscheibe", `Bremsscheibe vorne ${s < 0 ? "links" : "rechts"}`, "zyl", { r: 0.155, h: 0.006, achse: "z", pos: [xV, r, s * 0.075], mat: "stahl", gelocht: true, anim: { art: "drehen", achse: "z", tempo: -1 }, explo: [0.4, 0, s * 0.25] });
  for (const s of [-1, 1]) t("fahrwerk", "bremssattel", `Bremssattel vorne ${s < 0 ? "links" : "rechts"}`, "box", { g: [0.1, 0.06, 0.04], rund: 0.01, pos: [xV - 0.11, r + 0.08, s * 0.09], rot: [0, 0, -0.9], mat: "lack", farbe: "#ff7a1a", explo: [0.35, 0.1, s * 0.3] });
  t("fahrwerk", "bremsscheibe", "Bremsscheibe hinten", "zyl", { r: 0.11, h: 0.005, achse: "z", pos: [xH, r, 0.11], mat: "stahl", gelocht: true, anim: { art: "drehen", achse: "z", tempo: -1 }, explo: [-0.4, 0, 0.3] });
  t("fahrwerk", "schwinge", "Schwinge", "rohr", { punkte: [[-0.16, 0.36, -0.13], [xH, r, -0.13], [xH, r, 0.13], [-0.16, 0.36, 0.13]], d: 0.05, mat: "alu", explo: [-0.3, -0.15, 0] });
  t("fahrwerk", "feder", "Federbein (Feder)", "feder", { r: 0.035, h: 0.24, windungen: 7, d: 0.009, pos: [-0.26, 0.55, 0], rot: [0, 0, 0.55], mat: "lack", farbe: "#ff7a1a", explo: [-0.1, 0.35, 0] });
  t("fahrwerk", "daempfer", "Federbein (Dämpfer)", "zyl", { r: 0.015, h: 0.3, achse: "y", pos: [-0.26, 0.55, 0], rot: [0, 0, 0.55], mat: "chrom", explo: [-0.1, 0.35, 0] });
  // Lenkung
  for (const s of [-1, 1]) t("lenkung", "gabel", `Gabelrohr ${s < 0 ? "links" : "rechts"}`, "zyl", { r: 0.026, h: 0.72, achse: "y", pos: [xV + dir[0] * 0.36, r + dir[1] * 0.36, s * 0.1], rot: [0, 0, rake], mat: "messing", explo: [0.3, 0.2, s * 0.15] });
  t("lenkung", "gabelbruecke", "Gabelbrücke", "box", { g: [0.07, 0.03, 0.27], rund: 0.01, pos: [xV + dir[0] * 0.66, r + dir[1] * 0.66, 0], rot: [0, 0, rake], mat: "alu", explo: [0.3, 0.35, 0] });
  t("lenkung", "lenker", "Lenker (Stummel)", "rohr", { punkte: [[0.41, 0.95, -0.34], [0.45, 0.93, -0.13], [0.45, 0.93, 0.13], [0.41, 0.95, 0.34]], d: 0.022, mat: "chrom", explo: [0.25, 0.45, 0] });
  t("lenkung", "scheinwerfer", "LED-Scheinwerfer", "kugel", { r: 0.09, skala: [0.7, 0.8, 1.3], pos: [0.66, 0.86, 0], mat: "leuchte", farbe: "#eaf6ff", explo: [0.5, 0.3, 0] });
  // Rahmen
  for (const s of [-1, 1]) t("rahmen", "rahmen", `Brückenrahmen ${s < 0 ? "links" : "rechts"}`, "rohr", { punkte: [[0.45, 0.92, s * 0.06], [0.2, 0.83, s * 0.16], [-0.12, 0.66, s * 0.16], [-0.18, 0.36, s * 0.13]], d: 0.065, mat: "alu", farbe: "#b8bdc2", explo: [0, 0, s * 0.3] });
  for (const s of [-1, 1]) t("rahmen", "heckrahmen", `Heckrahmen ${s < 0 ? "links" : "rechts"}`, "rohr", { punkte: [[-0.14, 0.7, s * 0.1], [-0.5, 0.8, s * 0.08], [-0.8, 0.86, s * 0.05]], d: 0.028, mat: "stahl", explo: [-0.2, 0.1, s * 0.25] });
  // Motor (Reihenvierer, quer)
  const kc = [0.04, 0.36], d = [0.5, 0.866], rotZ = -0.52;
  const ap = (a) => [kc[0] + d[0] * a, kc[1] + d[1] * a];
  t("motor", "motorblock", "Kurbelgehäuse", "box", { g: [0.32, 0.22, 0.42], rund: 0.03, pos: [kc[0] - 0.02, kc[1] - 0.04, 0], mat: "alu", farbe: "#3b3f45", explo: [0, -0.2, 0] });
  t("motor", "zylinderbank", "Zylinderblock", "box", { g: [0.17, 0.18, 0.4], rund: 0.02, pos: [...ap(0.19), 0], rot: [0, 0, rotZ], mat: "alu", farbe: "#4a4f56", lamellen: true, explo: [0.15, 0.25, 0] });
  t("motor", "zylinderkopf", "Zylinderkopf", "box", { g: [0.2, 0.08, 0.42], rund: 0.02, pos: [...ap(0.32), 0], rot: [0, 0, rotZ], mat: "alu", farbe: "#8f959b", explo: [0.25, 0.4, 0] });
  t("motor", "ventildeckel", "Ventildeckel", "box", { g: [0.17, 0.04, 0.37], rund: 0.02, pos: [...ap(0.38), 0], rot: [0, 0, rotZ], mat: "lack", farbe: "#ff7a1a", explo: [0.3, 0.55, 0] });
  t("motor", "kurbelwelle", "Kurbelwelle", "kurbelwelle", { laenge: 0.42, r: 0.022, kroepfungen: 4, hub: 0.03, achse: "z", pos: [...kc, 0], mat: "stahl", anim: { art: "drehen", achse: "z", tempo: 1 }, explo: [0, -0.3, 0] });
  [-0.135, -0.045, 0.045, 0.135].forEach((z, i) => {
    t("motor", "kolben", `Kolben ${i + 1}`, "zyl", { r: 0.033, h: 0.05, achse: "y", pos: [...ap(0.13), z], rot: [0, 0, rotZ], mat: "alu", farbe: "#d9dde1", anim: { art: "hub", richtung: [d[0], d[1], 0], hub: 0.028, phase: i === 0 || i === 3 ? 0 : PI }, explo: [d[0] * 0.5, d[1] * 0.5, 0] });
    t("motor", "pleuel", `Pleuel ${i + 1}`, "box", { g: [0.018, 0.1, 0.03], pos: [...ap(0.07), z], rot: [0, 0, rotZ], mat: "stahl", anim: { art: "hub", richtung: [d[0], d[1], 0], hub: 0.02, phase: i === 0 || i === 3 ? 0 : PI }, explo: [d[0] * 0.35, d[1] * 0.35, 0] });
    t("auspuff", "kruemmer", `Krümmer ${i + 1}`, "rohr", { punkte: [[ap(0.3)[0] + 0.1, ap(0.3)[1] - 0.06, z], [0.36, 0.38, z * 0.8], [0.3, 0.14, z * 0.4], [0.02, 0.1, z * 0.15]].map(v3), d: 0.032, mat: "stahl", farbe: "#a88a6a", explo: [0.25, -0.15, z] });
  });
  t("motor", "kuehler", "Kühler", "box", { g: [0.04, 0.3, 0.42], pos: [0.4, 0.55, 0], rot: [0, 0, -0.25], mat: "alu", farbe: "#6d7278", lamellen: true, explo: [0.4, 0.1, 0] });
  t("auspuff", "abgasrohr", "Sammelrohr", "rohr", { punkte: [[0.02, 0.1, 0.02], [-0.2, 0.12, 0.08], [-0.36, 0.25, 0.17]], d: 0.05, mat: "stahl", explo: [-0.1, -0.15, 0.15] });
  t("auspuff", "endtopf", "Endtopf", "zyl", { r: 0.06, r2: 0.05, h: 0.38, achse: "x", pos: [-0.52, 0.33, 0.17], rot: [0, 0, 0.32], mat: "carbon", explo: [-0.3, 0, 0.3] });
  // Antrieb
  t("antrieb", "getriebe", "6-Gang-Getriebe", "box", { g: [0.24, 0.18, 0.3], rund: 0.03, pos: [-0.17, 0.4, 0], mat: "alu", farbe: "#454a50", explo: [-0.15, -0.1, 0] });
  t("antrieb", "ritzel", "Ritzel (15 Zähne)", "zahnrad", { r: 0.045, zaehne: 15, dicke: 0.02, achse: "z", pos: [-0.16, 0.38, -0.13], mat: "stahl", anim: { art: "drehen", achse: "z", tempo: -2.8 }, explo: [0, 0, -0.3] });
  t("antrieb", "kettenrad", "Kettenrad (43 Zähne)", "zahnrad", { r: 0.115, zaehne: 43, dicke: 0.008, achse: "z", pos: [xH, r, -0.13], mat: "alu", farbe: "#ff7a1a", anim: { art: "drehen", achse: "z", tempo: -1 }, explo: [-0.2, 0, -0.35] });
  t("antrieb", "kette", "Kette", "rohr", { punkte: [[-0.16, 0.428, -0.13], [xH, r + 0.118, -0.13], [xH - 0.118, r, -0.13], [xH, r - 0.118, -0.13], [-0.16, 0.332, -0.13], [-0.112, 0.38, -0.13], [-0.16, 0.428, -0.13]].map(v3), d: 0.012, mat: "stahl", explo: [-0.1, 0, -0.45] });
  // Verkleidung
  t("verkleidung", "motorrad_tank", "Tank (17 l)", "kugel", { r: 0.2, skala: [1.45, 0.75, 1.0], pos: [0.12, 0.93, 0], mat: "lack", farbe: "#ff6a14", explo: [0, 0.5, 0] });
  t("verkleidung", "sitzbank", "Sitzbank", "box", { g: [0.42, 0.07, 0.25], rund: 0.03, pos: [-0.36, 0.88, 0], rot: [0, 0, -0.08], mat: "leder", farbe: "#1b1c1f", explo: [-0.1, 0.45, 0] });
  t("verkleidung", "heckverkleidung", "Heckverkleidung", "box", { g: [0.36, 0.11, 0.17], rund: 0.04, pos: [-0.72, 0.92, 0], rot: [0, 0, -0.18], mat: "lack", farbe: "#ff6a14", explo: [-0.35, 0.4, 0] });
  // Elektrik
  t("elektrik", "batterie", "Batterie", "box", { g: [0.15, 0.09, 0.09], rund: 0.01, pos: [-0.32, 0.72, 0], mat: "kunststoff", farbe: "#202226", explo: [0, 0.3, 0.3] });
  t("elektrik", "steuergeraet", "Steuergerät", "box", { g: [0.12, 0.03, 0.09], pos: [-0.52, 0.78, 0], mat: "alu", explo: [-0.1, 0.3, -0.3] });
  return {
    id: "motorrad",
    name: "Sportmotorrad",
    symbol: "🏍️",
    kurz: "Supersportler mit 1.000-cm³-Reihenvierzylinder, Alu-Brückenrahmen und Kettenantrieb.",
    kamera: { dist: 3.4, ziel: [0, 0.5, 0] },
    gruppen: [
      { id: "verkleidung", name: "Tank & Sitz", symbol: "🟧", raus: [[0, 0.7, 0]] },
      { id: "motor", name: "Motor", symbol: "⚙️", raus: [[0, 0, 0], [0, 0, 1.1], [0, -0.1, 1.1]], braucht: ["verkleidung"] },
      { id: "auspuff", name: "Auspuff", symbol: "💨", raus: [[0, -0.1, 0.9]] },
      { id: "antrieb", name: "Getriebe & Kette", symbol: "⛓️", raus: [[0, 0, -1.0]] },
      { id: "lenkung", name: "Gabel & Lenker", symbol: "🎯", raus: [[0.9, 0, 0]] },
      { id: "fahrwerk", name: "Räder & Fahrwerk", symbol: "🛞", raus: [[0, 0, 0]] },
      { id: "rahmen", name: "Rahmen", symbol: "🦴", raus: [[0, 0.5, 0]] },
      { id: "elektrik", name: "Elektrik", symbol: "⚡", raus: [[0, 0.6, -0.6]], braucht: ["verkleidung"] },
    ],
    teile,
    daten: [
      { label: "Motor", wert: "1.000 cm³ Reihenvierer" }, { label: "Leistung", wert: "ca. 210 PS bei 13.500 U/min" }, { label: "Spitze", wert: "ca. 299 km/h" },
      { label: "Gewicht", wert: "ca. 200 kg vollgetankt" }, { label: "Radstand", wert: "1,45 m" }, { label: "Lenkkopfwinkel", wert: "ca. 24°" },
    ],
  };
}

// ---------- Modell 5: Mantelstrom-Triebwerk (Turbofan) ----------
function triebwerk() {
  const { teile, t } = baukasten();
  const stufen = (gruppe, art, name, xs, rs, nabe, tempo, mat, farbe, schaufeln) => xs.forEach((x, i) => t(gruppe, art, `${name} Stufe ${i + 1}`, "luefter", { r: rs[i], nabe: nabe[i] ?? nabe[0], schaufeln, tiefe: 0.035, drall: 0.7, achse: "x", pos: [x, 0, 0], mat, farbe, anim: { art: "drehen", achse: "x", tempo }, explo: [0, 0, 0] }));
  t("gondel", "gondel", "Triebwerksgondel", "dreh", { profil: [[0.95, 1.62], [1.01, 1.64], [1.07, 1.3], [1.08, 0.6], [1.03, -0.4], [0.9, -1.25], [0.86, -1.25], [0.94, -0.4], [0.98, 0.6], [0.97, 1.3]], zu: true, achse: "x", mat: "lack", farbe: "#e9ecef", explo: [0, 0, 0] });
  t("fan", "spinner", "Spinner", "dreh", { profil: [[0, 1.22], [0.1, 1.17], [0.22, 1.03], [0.3, 0.85], [0, 0.85]], achse: "x", mat: "carbon", spirale: true, anim: { art: "drehen", achse: "x", tempo: 1.1 }, explo: [1.2, 0, 0] });
  t("fan", "fan", "Fan (22 Schaufeln)", "luefter", { r: 0.94, nabe: 0.3, schaufeln: 22, tiefe: 0.22, drall: 0.75, breit: true, achse: "x", pos: [0.8, 0, 0], mat: "titan", anim: { art: "drehen", achse: "x", tempo: 1.1 }, explo: [1.0, 0, 0] });
  t("fan", "leitschaufeln", "Leitschaufeln hinter dem Fan", "luefter", { r: 0.95, nabe: 0.52, schaufeln: 40, tiefe: 0.08, drall: -0.35, achse: "x", pos: [0.38, 0, 0], mat: "alu", farbe: "#9aa0a6", explo: [0.6, 0, 0] });
  t("kern", "kerngehaeuse", "Kerngehäuse", "dreh", { profil: [[0.5, 0.62], [0.53, 0.35], [0.51, -0.25], [0.43, -1.0], [0.34, -1.45], [0.31, -1.45], [0.4, -1.0], [0.48, -0.25], [0.5, 0.35], [0.47, 0.62]], zu: true, achse: "x", mat: "alu", farbe: "#6c7178", explo: [0, 0, 0] });
  stufen("verdichter", "nd_verdichter", "Niederdruckverdichter", [0.6, 0.52, 0.45], [0.46, 0.45, 0.44], [0.3], 1.1, "titan", null, 30);
  stufen("verdichter", "hd_verdichter", "Hochdruckverdichter", [0.32, 0.27, 0.22, 0.17, 0.12, 0.07, 0.02, -0.03], [0.4, 0.385, 0.37, 0.355, 0.34, 0.325, 0.31, 0.3], [0.26, 0.255, 0.25, 0.245, 0.24, 0.235, 0.23, 0.225], 3.2, "titan", "#bfc4c9", 36);
  t("brennkammer", "brennkammer", "Ring-Brennkammer", "torus", { r: 0.3, dicke: 0.075, achse: "x", pos: [-0.2, 0, 0], mat: "glut", explo: [0, 0, 0] });
  stufen("turbine", "hd_turbine", "Hochdruckturbine", [-0.38, -0.44], [0.34, 0.35], [0.25], 3.2, "stahl", "#8a6a4a", 40);
  stufen("turbine", "nd_turbine", "Niederdruckturbine", [-0.6, -0.7, -0.8, -0.9, -1.0], [0.37, 0.39, 0.41, 0.42, 0.42], [0.24, 0.24, 0.23, 0.23, 0.22], 1.1, "stahl", "#9b7f62", 44);
  t("welle", "nd_welle", "Niederdruckwelle (innen)", "zyl", { r: 0.04, h: 2.0, achse: "x", pos: [-0.15, 0, 0], mat: "stahl", anim: { art: "drehen", achse: "x", tempo: 1.1 }, explo: [0, 0, 0] });
  t("welle", "hd_welle", "Hochdruckwelle (außen)", "zyl", { r: 0.075, h: 0.82, achse: "x", pos: [-0.06, 0, 0], mat: "titan", anim: { art: "drehen", achse: "x", tempo: 3.2 }, explo: [0, 0, 0] });
  t("duese", "schubduese", "Schubdüse", "dreh", { profil: [[0.33, -1.42], [0.3, -1.95], [0.27, -1.95], [0.3, -1.42]], zu: true, achse: "x", mat: "stahl", farbe: "#7a6a5a", explo: [-0.6, 0, 0] });
  t("duese", "abgaskegel", "Abgaskegel", "dreh", { profil: [[0, -2.12], [0.1, -1.9], [0.2, -1.55], [0.22, -1.42], [0, -1.42]], achse: "x", mat: "stahl", farbe: "#8a7b6a", explo: [-1.0, 0, 0] });
  t("anbau", "zubehoergetriebe", "Zubehörgetriebe", "box", { g: [0.62, 0.14, 0.32], rund: 0.04, pos: [0.15, -1.12, 0], mat: "alu", farbe: "#8a9096", explo: [0, -0.5, 0] });
  t("anbau", "pylon", "Pylon (Flügel-Aufhängung)", "box", { g: [1.9, 0.4, 0.2], rund: 0.06, pos: [-0.1, 1.28, 0], mat: "lack", farbe: "#d9dde1", explo: [0, 0.7, 0] });
  return {
    id: "triebwerk",
    name: "Flugzeug-Triebwerk",
    symbol: "✈️",
    kurz: "Mantelstrom-Triebwerk (Turbofan) wie an einem Mittelstreckenjet – zwei Wellen, 1 große Fan-Stufe.",
    kamera: { dist: 6.5, ziel: [0, 0, 0] },
    roentgen: true,
    gruppen: [
      { id: "gondel", name: "Gondel", symbol: "🛡️", huelle: true, raus: [[0, 0, 2.8]] },
      { id: "anbau", name: "Pylon & Anbauteile", symbol: "🔩", raus: [[0, 0.6, 0]] },
      { id: "fan", name: "Fan & Spinner", symbol: "🌀", raus: [[2.0, 0, 0]], braucht: ["gondel"] },
      { id: "kern", name: "Kerngehäuse", symbol: "🧱", huelle: true, raus: [[0, 0, -2.2]], braucht: ["gondel"] },
      { id: "verdichter", name: "Verdichter", symbol: "🌬️", raus: [[0, 1.2, 0]], braucht: ["kern"] },
      { id: "brennkammer", name: "Brennkammer", symbol: "🔥", raus: [[0, -1.4, 0]], braucht: ["kern"] },
      { id: "turbine", name: "Turbinen", symbol: "⚙️", raus: [[0, 1.2, -0.4]], braucht: ["kern"] },
      { id: "welle", name: "Wellen", symbol: "➖", raus: [[0, -1.2, 1.2]], braucht: ["verdichter", "turbine"] },
      { id: "duese", name: "Schubdüse", symbol: "💨", raus: [[-1.4, 0, 0]] },
    ],
    teile,
    daten: [
      { label: "Schub", wert: "ca. 130 kN" }, { label: "Fan-Durchmesser", wert: "ca. 1,9 m" }, { label: "Nebenstromverhältnis", wert: "ca. 11 : 1" },
      { label: "Verdichtung", wert: "ca. 40 : 1" }, { label: "Fan-Drehzahl", wert: "ca. 4.000 U/min" }, { label: "Gewicht", wert: "ca. 2.900 kg" },
    ],
  };
}

// ---------- Modell 6: 6-Gang-Schaltgetriebe ----------
function schaltgetriebe() {
  const { teile, t } = baukasten();
  const yH = 0.12, yV = 0, A = 0.12; // Achsabstand Haupt-/Vorgelegewelle
  const wV = -0.05 / 0.07; // Vorgelegewelle (über Konstante angetrieben)
  t("gehaeuse", "getriebegehaeuse", "Getriebegehäuse", "box", { g: [0.78, 0.34, 0.26], rund: 0.06, pos: [0.0, 0.06, 0], mat: "alu", farbe: "#9aa0a6", explo: [0, 0, 0.6] });
  t("kupplung", "schwungrad", "Schwungrad", "zyl", { r: 0.145, h: 0.035, achse: "x", pos: [0.58, yH, 0], mat: "stahl", anim: { art: "drehen", achse: "x", tempo: 1 }, explo: [0.45, 0, 0] });
  t("kupplung", "kupplungsscheibe", "Kupplungsscheibe", "zyl", { r: 0.11, h: 0.012, achse: "x", pos: [0.545, yH, 0], mat: "carbon", anim: { art: "drehen", achse: "x", tempo: 1 }, explo: [0.35, 0, 0] });
  t("kupplung", "druckplatte", "Druckplatte", "zyl", { r: 0.118, h: 0.03, achse: "x", pos: [0.515, yH, 0], mat: "stahl", farbe: "#b8bcc0", anim: { art: "drehen", achse: "x", tempo: 1 }, explo: [0.25, 0, 0] });
  t("wellen", "eingangswelle", "Eingangswelle", "zyl", { r: 0.018, h: 0.3, achse: "x", pos: [0.37, yH, 0], mat: "stahl", anim: { art: "drehen", achse: "x", tempo: 1 }, explo: [0.15, 0.1, 0] });
  t("wellen", "vorgelegewelle", "Vorgelegewelle", "zyl", { r: 0.018, h: 0.64, achse: "x", pos: [0.0, yV, 0], mat: "stahl", anim: { art: "drehen", achse: "x", tempo: wV }, explo: [0, -0.3, 0] });
  t("zahnraeder", "zahnrad_konstante", "Konstante (Eingang)", "zahnrad", { r: 0.05, zaehne: 18, dicke: 0.024, achse: "x", pos: [0.25, yH, 0], mat: "stahl", anim: { art: "drehen", achse: "x", tempo: 1 }, explo: [0, 0.15, 0] });
  t("zahnraeder", "zahnrad_konstante", "Konstante (Vorgelege)", "zahnrad", { r: 0.07, zaehne: 25, dicke: 0.024, achse: "x", pos: [0.25, yV, 0], mat: "stahl", anim: { art: "drehen", achse: "x", tempo: wV, versatz: PI / 25 }, explo: [0, -0.15, 0] });
  // Gänge: rv = Radius auf der Vorgelegewelle, Hauptwelle bekommt A − rv.
  const GAENGE = [["6. Gang", 0.069, 0.17], ["5. Gang", 0.063, 0.13], ["4. Gang", 0.056, 0.09], ["3. Gang", 0.048, 0.05], ["2. Gang", 0.039, 0.0], ["1. Gang", 0.03, -0.05]];
  let wHaupt = 1;
  for (const [name, rv, x] of GAENGE) {
    const rh = A - rv;
    const wh = -wV * rv / rh;
    if (name === "3. Gang") wHaupt = wh;
    t("zahnraeder", "zahnrad_gang", `${name} (Hauptwelle)`, "zahnrad", { r: rh, zaehne: Math.round(rh * 360), dicke: 0.022, achse: "x", pos: [x, yH, 0], mat: name === "3. Gang" ? "messing" : "stahl", anim: { art: "drehen", achse: "x", tempo: wh }, explo: [0, 0.18, 0] });
    t("zahnraeder", "zahnrad_gang", `${name} (Vorgelege)`, "zahnrad", { r: rv, zaehne: Math.round(rv * 360), dicke: 0.022, achse: "x", pos: [x, yV, 0], mat: "stahl", anim: { art: "drehen", achse: "x", tempo: wV, versatz: PI / Math.round(rv * 360) }, explo: [0, -0.18, 0] });
  }
  t("zahnraeder", "zahnrad_gang", "Rückwärtsgang (Vorgelege)", "zahnrad", { r: 0.028, zaehne: 10, dicke: 0.02, achse: "x", pos: [-0.12, yV, 0], mat: "stahl", anim: { art: "drehen", achse: "x", tempo: wV }, explo: [0, -0.18, 0] });
  t("zahnraeder", "rueckwaertsrad", "Rückwärts-Zwischenrad", "zahnrad", { r: 0.03, zaehne: 11, dicke: 0.02, achse: "x", pos: [-0.12, 0.03, 0.057], mat: "stahl", anim: { art: "drehen", achse: "x", tempo: -wV * 0.028 / 0.03 }, explo: [0, 0, 0.25] });
  t("wellen", "hauptwelle", "Hauptwelle (Abtrieb)", "zyl", { r: 0.02, h: 0.52, achse: "x", pos: [-0.03, yH, 0], mat: "stahl", anim: { art: "drehen", achse: "x", tempo: wHaupt }, explo: [0, 0.32, 0] });
  t("wellen", "abtriebsflansch", "Abtriebsflansch", "zyl", { r: 0.045, h: 0.03, achse: "x", pos: [-0.31, yH, 0], mat: "stahl", anim: { art: "drehen", achse: "x", tempo: wHaupt }, explo: [-0.3, 0.1, 0] });
  // Schaltung: Muffen zwischen den Gängen, Gabeln darüber
  [[0.11, "5/6"], [0.025, "3/4"], [-0.085, "1/2"]].forEach(([x, gg], i) => {
    t("schaltung", "schaltmuffe", `Schaltmuffe ${gg}`, "zyl", { r: 0.038, h: 0.022, achse: "x", pos: [x, yH, 0], mat: "messing", anim: { art: "drehen", achse: "x", tempo: wHaupt }, explo: [0, 0.25, 0] });
    t("schaltung", "schaltgabel", `Schaltgabel ${gg}`, "box", { g: [0.01, 0.08, 0.07], pos: [x, yH + 0.07, 0], mat: "stahl", farbe: "#c9a24a", explo: [0, 0.38, 0] });
    t("schaltung", "schaltstange", `Schaltstange ${gg}`, "zyl", { r: 0.006, h: 0.5, achse: "x", pos: [0.0, yH + 0.115, (i - 1) * 0.03], mat: "chrom", explo: [0, 0.45, 0] });
  });
  return {
    id: "schaltgetriebe",
    name: "6-Gang-Schaltgetriebe",
    symbol: "🔩",
    kurz: "Klassisches Handschaltgetriebe mit Kupplung – eingelegt ist der 3. Gang (goldenes Zahnrad).",
    kamera: { dist: 1.4, ziel: [0.08, 0.07, 0] },
    roentgen: true,
    gruppen: [
      { id: "gehaeuse", name: "Gehäuse", symbol: "🧱", huelle: true, raus: [[0, 0, 0.7]] },
      { id: "kupplung", name: "Kupplung", symbol: "⭕", raus: [[0.45, 0, 0]] },
      { id: "schaltung", name: "Schaltung", symbol: "🕹️", raus: [[0, 0.45, 0]], braucht: ["gehaeuse"] },
      { id: "zahnraeder", name: "Zahnräder", symbol: "⚙️", raus: [[0, 0, -0.6]], braucht: ["gehaeuse"] },
      { id: "wellen", name: "Wellen", symbol: "➖", raus: [[0, -0.45, 0]], braucht: ["gehaeuse"] },
    ],
    teile,
    daten: [
      { label: "Gänge", wert: "6 + Rückwärtsgang" }, { label: "Bauart", wert: "Zwei-Wellen, synchronisiert" }, { label: "1. Gang", wert: "ca. 3,5 : 1" },
      { label: "6. Gang", wert: "ca. 0,8 : 1" }, { label: "Max. Drehmoment", wert: "ca. 400 Nm" }, { label: "Gewicht", wert: "ca. 45 kg" },
    ],
  };
}

// ---------- Modell 7: Gaming-PC ----------
function gamingpc() {
  const { teile, t } = baukasten();
  // Gehäuse 0,45 tief (x) × 0,47 hoch (y) × 0,22 breit (z); Mainboard an der Rückwand (z = −0,09)
  t("gehaeuse", "pc_gehaeuse", "Gehäuse", "box", { g: [0.45, 0.47, 0.22], rund: 0.01, pos: [0, 0.235, 0], mat: "alu", farbe: "#1a1c20", explo: [0, 0, -0.3] });
  t("gehaeuse", "seitenteil", "Glas-Seitenteil", "box", { g: [0.44, 0.46, 0.005], pos: [0, 0.235, 0.113], mat: "glas", explo: [0, 0, 0.35] });
  t("mainboard", "mainboard", "Mainboard (ATX)", "box", { g: [0.305, 0.244, 0.004], pos: [0.0, 0.3, -0.095], mat: "platine", explo: [0, 0, -0.15] });
  t("cpu", "cpu", "Prozessor (CPU)", "box", { g: [0.045, 0.045, 0.006], pos: [0.02, 0.36, -0.09], mat: "chrom", explo: [0, 0, 0.12] });
  t("cpu", "cpu_kuehler", "CPU-Kühler (Tower)", "box", { g: [0.05, 0.155, 0.13], pos: [0.02, 0.36, -0.024], mat: "alu", farbe: "#c8ccd0", lamellen: true, explo: [0, 0, 0.25] });
  t("cpu", "cpu_luefter", "CPU-Lüfter", "luefter", { r: 0.058, nabe: 0.02, schaufeln: 9, tiefe: 0.02, drall: 0.6, achse: "x", rahmen: true, pos: [0.06, 0.36, -0.024], mat: "kunststoff", farbe: "#1d1f23", anim: { art: "drehen", achse: "x", tempo: 4 }, explo: [0.15, 0, 0.25] });
  for (let i = 0; i < 4; i++) t("ram", "ram", `Arbeitsspeicher ${i + 1} (16 GB)`, "box", { g: [0.007, 0.133, 0.034], pos: [0.1 + i * 0.011, 0.34, -0.075], mat: "alu", farbe: "#202226", rgb: true, explo: [0, 0.1, 0.12 + i * 0.03] });
  t("gpu", "gpu", "Grafikkarte", "box", { g: [0.3, 0.12, 0.06], rund: 0.008, pos: [-0.02, 0.2, -0.05], mat: "kunststoff", farbe: "#26292e", explo: [0, -0.05, 0.3] });
  for (const x of [-0.115, -0.015, 0.085]) t("gpu", "gpu_luefter", "Grafikkarten-Lüfter", "luefter", { r: 0.042, nabe: 0.014, schaufeln: 11, tiefe: 0.012, drall: 0.6, achse: "y", pos: [x, 0.138, -0.05], mat: "kunststoff", farbe: "#111214", anim: { art: "drehen", achse: "y", tempo: 3 }, explo: [0, -0.1, 0.3] });
  t("strom", "netzteil", "Netzteil (850 W)", "box", { g: [0.15, 0.086, 0.15], rund: 0.005, pos: [-0.13, 0.05, 0], mat: "alu", farbe: "#15171a", explo: [-0.25, -0.15, 0] });
  t("strom", "stromkabel", "Mainboard-Stromkabel", "rohr", { punkte: [[-0.06, 0.08, 0.04], [0.08, 0.12, 0.06], [0.15, 0.25, 0.0], [0.15, 0.32, -0.08]], d: 0.018, mat: "kunststoff", farbe: "#ff7a1a", explo: [-0.15, -0.05, 0.1] });
  t("strom", "stromkabel", "Grafikkarten-Stromkabel", "rohr", { punkte: [[-0.1, 0.095, 0.03], [-0.12, 0.16, 0.0], [-0.1, 0.26, -0.03]], d: 0.012, mat: "kunststoff", farbe: "#ff7a1a", explo: [-0.15, -0.05, 0.1] });
  t("speicher", "ssd", "M.2-SSD (2 TB)", "box", { g: [0.08, 0.022, 0.003], pos: [0.0, 0.27, -0.092], mat: "platine", farbe: "#0e1a2a", explo: [0.05, 0.05, 0.22] });
  t("speicher", "hdd", "Festplatte (8 TB)", "box", { g: [0.147, 0.026, 0.102], rund: 0.004, pos: [0.13, 0.03, 0.0], mat: "alu", explo: [0.25, -0.1, 0] });
  for (const y of [0.1, 0.235, 0.37]) t("lueftung", "gehaeuseluefter", "Frontlüfter", "luefter", { r: 0.06, nabe: 0.02, schaufeln: 9, tiefe: 0.02, drall: 0.6, achse: "x", rahmen: true, rgb: true, pos: [0.205, y, 0], mat: "kunststoff", farbe: "#e8eaee", anim: { art: "drehen", achse: "x", tempo: 3 }, explo: [0.25, 0, 0] });
  t("lueftung", "gehaeuseluefter", "Hecklüfter", "luefter", { r: 0.06, nabe: 0.02, schaufeln: 9, tiefe: 0.02, drall: 0.6, achse: "x", rahmen: true, rgb: true, pos: [-0.205, 0.38, -0.04], mat: "kunststoff", farbe: "#e8eaee", anim: { art: "drehen", achse: "x", tempo: 3 }, explo: [-0.25, 0, 0] });
  return {
    id: "gaming-pc",
    name: "Gaming-PC",
    symbol: "🖥️",
    kurz: "Midi-Tower mit Glasseite: Prozessor, Grafikkarte, RAM, SSD, Netzteil und Lüfter.",
    kamera: { dist: 1.3, ziel: [0, 0.23, 0] },
    roentgen: true,
    gruppen: [
      { id: "gehaeuse", name: "Gehäuse", symbol: "🧱", huelle: true, raus: [[0, 0, -0.6]] },
      { id: "gpu", name: "Grafikkarte", symbol: "🎮", raus: [[0, 0, 0.45]], info: "Die Grafikkarte zieht man nach vorne aus dem PCIe-Steckplatz." },
      { id: "cpu", name: "CPU & Kühler", symbol: "🧠", raus: [[0, 0.1, 0.5]] },
      { id: "ram", name: "Arbeitsspeicher", symbol: "📏", raus: [[0, 0.3, 0.3]] },
      { id: "speicher", name: "Speicher", symbol: "💾", raus: [[0.4, 0, 0.2]] },
      { id: "strom", name: "Netzteil & Kabel", symbol: "🔌", raus: [[-0.4, 0, 0.2]] },
      { id: "lueftung", name: "Gehäuselüfter", symbol: "🌀", raus: [[0, 0, 0.45]] },
      { id: "mainboard", name: "Mainboard", symbol: "🟩", raus: [[0, 0, 0.6]], braucht: ["cpu", "ram", "gpu", "speicher"] },
    ],
    teile,
    daten: [
      { label: "Prozessor", wert: "16 Kerne, bis 5,7 GHz" }, { label: "Grafik", wert: "16 GB Grafikspeicher" }, { label: "RAM", wert: "64 GB (4 × 16)" },
      { label: "Speicher", wert: "2 TB SSD + 8 TB HDD" }, { label: "Netzteil", wert: "850 W" }, { label: "Gewicht", wert: "ca. 14 kg" },
    ],
  };
}

const BAU = [sportwagen, elektroauto, v8motor, motorrad, triebwerk, schaltgetriebe, gamingpc];
let cache = null;
function alle() {
  if (cache) return cache;
  cache = BAU.map((f) => {
    const m = f();
    // Wissen zu jedem Teil anhängen (Name aus dem Teil, Rest aus ARTEN)
    m.teile = m.teile.map((p) => ({ ...p, info: ARTEN[p.art] || null }));
    m.anzahl = m.teile.length;
    return m;
  });
  return cache;
}

// Wörter, an denen Friday ein Modell erkennt.
const WORTE = {
  "sportwagen-v8": ["sportwagen", "sportauto", "auto", "wagen", "coupe", "coupé", "supersportwagen", "verbrenner"],
  elektroauto: ["elektroauto", "e-auto", "e auto", "eauto", "elektro auto", "elektrowagen", "tesla", "akku auto", "stromer"],
  "v8-motor": ["v8", "v8-motor", "v-8", "achtzylinder", "motor", "verbrennungsmotor", "benzinmotor"],
  motorrad: ["motorrad", "bike", "superbike", "supersportler", "maschine"],
  triebwerk: ["triebwerk", "düsentriebwerk", "duesentriebwerk", "turbine", "jet", "flugzeugtriebwerk", "turbofan", "strahltriebwerk"],
  schaltgetriebe: ["getriebe", "schaltgetriebe", "gangschaltung", "zahnräder", "zahnraeder"],
  "gaming-pc": ["pc", "computer", "gaming-pc", "gaming pc", "rechner", "grafikkarte"],
};
const norm = (s) => String(s || "").toLowerCase().replace(/ß/g, "ss").replace(/[^\p{L}\p{N}\- ]+/gu, " ").replace(/\s+/g, " ").trim();
const hat = (text, wort) => new RegExp(`(^|[^\\p{L}])${wort.replace(/[-]/g, "[- ]?")}(?=$|[^\\p{L}])`, "u").test(text);

export function findeModell(text) {
  const t = norm(text);
  // Genauere Treffer zuerst: "V8-Motor" vor "Auto", "E-Auto" vor "Auto", "Motorrad" vor "Motor".
  const reihenfolge = ["elektroauto", "motorrad", "triebwerk", "schaltgetriebe", "gaming-pc", "v8-motor", "sportwagen-v8"];
  for (const id of reihenfolge) if (WORTE[id].some((w) => hat(t, norm(w)))) {
    // "Motor raus aus dem Sportwagen" → Sportwagen, nicht V8 einzeln
    if (id === "v8-motor" && WORTE["sportwagen-v8"].some((w) => hat(t, norm(w)))) return "sportwagen-v8";
    return id;
  }
  return null;
}

/** Ist das ein Befehl fürs Zerlege-Labor? ("zerleg mir einen V8", "nimm den Motor aus dem Auto raus", "zeig mir das Triebwerk von innen") */
export function istZerlegeBefehl(text) {
  const t = norm(text);
  if (/zerlege ?-?labor|teile ?-?labor|explosionsansicht|explosionszeichnung/.test(t)) return true;
  if (/\bzerleg|auseinander ?(nehmen|bauen|bau|nimm)|nimm .* auseinander|bau .* auseinander/.test(t)) return true;
  if (/von innen|innenleben|wie (ist|sieht) .* (aufgebaut|innen aus)|wie funktioniert (ein|eine|der|die|das) /.test(t) && findeModell(t)) return true;
  if (/\b(raus|heraus|ausbauen|ausbau|herausnehmen|rausnehmen|rausholen)\b|\bnimm\b.*\baus (dem|der)\b/.test(t) && /\b(motor|akku|batterie|getriebe|triebwerk|fan|kolben|grafikkarte|kurbelwelle)\b/.test(t)) return true;
  return false;
}

export function liste() {
  return alle().map((m) => ({ id: m.id, name: m.name, symbol: m.symbol, kurz: m.kurz, anzahl: m.anzahl, gruppen: m.gruppen.length }));
}
export function modell(id) {
  return alle().find((m) => m.id === id) || null;
}

export function quickCommand(text) {
  if (!text || !istZerlegeBefehl(text)) return null;
  if (!frei()) return { answer: `Das Zerlege-Labor ist noch im Test, ${boss()}. Probier es in Eve aus und gib es dort frei.`, actions: [] };
  const id = findeModell(text) || "sportwagen-v8";
  const m = modell(id);
  return { answer: `Zerlege-Labor auf, ${boss()}. ${m.name} mit ${m.anzahl} Teilen.`, actions: [`zerlegen:${id}:${encodeURIComponent(String(text).slice(0, 200))}`] };
}

export function zerlegeRouten(app) {
  app.get("/api/zerlegen", (req, res) => res.json({ ok: true, frei: frei(), modelle: liste() }));
  app.get("/api/zerlegen/:id", (req, res) => {
    if (!frei()) return res.status(403).json({ ok: false, error: "Das Zerlege-Labor ist noch im Test – in Eve freigeben." });
    const m = modell(req.params.id);
    if (!m) return res.status(404).json({ ok: false, error: "Dieses Modell kenne ich nicht." });
    res.json({ ok: true, modell: m });
  });
}
