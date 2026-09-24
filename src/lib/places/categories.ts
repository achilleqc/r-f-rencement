/**
 * Catégories de commerces proposées dans la recherche, avec leur correspondance
 * dans OpenStreetMap (tags) et dans Google Places (types « Table A »).
 */

export type OsmRule = {
  key: string;
  /** Valeurs acceptées (sinon : toutes les valeurs du tag). */
  values?: readonly string[];
  /** Valeurs exclues (quand `values` n'est pas défini). */
  exclude?: readonly string[];
};

export type CategoryDef = {
  id: string;
  label: string;
  osm: readonly OsmRule[];
  google: readonly string[];
};

const FOOD_SHOPS = [
  "bakery", "butcher", "pastry", "cheese", "deli", "greengrocer", "convenience", "wine", "alcohol", "beverages",
  "chocolate", "confectionery", "seafood", "coffee", "tea", "farm", "organic", "frozen_food", "spices", "supermarket",
  "health_food", "dairy", "pasta", "nuts", "food",
];
const BEAUTY_SHOPS = ["hairdresser", "beauty", "cosmetics", "massage", "tattoo", "perfumery", "piercing"];
const HEALTH_SHOPS = ["optician", "hearing_aids", "medical_supply", "herbalist"];
const AUTO_SHOPS = ["car", "car_repair", "car_parts", "tyres", "motorcycle", "motorcycle_repair"];
const SERVICE_SHOPS = ["dry_cleaning", "laundry", "travel_agency", "funeral_directors", "copyshop", "photo", "tailor", "pawnbroker", "locksmith", "repair", "computer_repair", "shoe_repair"];

export const CATEGORIES = [
  {
    id: "sante",
    label: "Santé (pharmacie, dentiste, kiné…)",
    osm: [
      { key: "amenity", values: ["pharmacy", "dentist", "doctors", "clinic", "veterinary"] },
      { key: "healthcare", exclude: ["hospital", "blood_donation", "vaccination_centre", "yes"] },
      { key: "shop", values: HEALTH_SHOPS },
    ],
    google: ["dentist", "doctor", "physiotherapist", "pharmacy", "veterinary_care"],
  },
  {
    id: "restauration",
    label: "Restaurants, cafés, bars",
    osm: [{ key: "amenity", values: ["restaurant", "cafe", "bar", "pub", "fast_food", "ice_cream", "biergarten", "food_court"] }],
    google: ["restaurant", "cafe", "bar", "meal_takeaway"],
  },
  {
    id: "alimentation",
    label: "Alimentation (boulangerie, boucherie, épicerie…)",
    osm: [{ key: "shop", values: FOOD_SHOPS }],
    google: ["bakery", "grocery_store", "convenience_store", "liquor_store", "supermarket"],
  },
  {
    id: "beaute",
    label: "Coiffure, beauté, bien-être",
    osm: [{ key: "shop", values: BEAUTY_SHOPS }],
    google: ["hair_care", "beauty_salon", "spa"],
  },
  {
    id: "auto",
    label: "Automobile (garage, carrosserie…)",
    osm: [
      { key: "shop", values: AUTO_SHOPS },
      { key: "amenity", values: ["car_wash", "car_rental", "driving_school"] },
    ],
    google: ["car_repair", "car_wash", "car_rental", "car_dealer"],
  },
  {
    id: "services",
    label: "Services (immobilier, avocat, pressing…)",
    osm: [
      { key: "office", values: ["estate_agent", "lawyer", "accountant", "insurance", "notary", "tax_advisor", "architect", "travel_agent", "financial_advisor"] },
      { key: "shop", values: SERVICE_SHOPS },
    ],
    google: ["real_estate_agency", "lawyer", "accounting", "insurance_agency", "travel_agency", "laundry"],
  },
  {
    id: "hebergement",
    label: "Hôtels et hébergement",
    osm: [{ key: "tourism", values: ["hotel", "guest_house", "hostel", "motel", "chalet", "apartment"] }],
    google: ["lodging"],
  },
  {
    id: "sport",
    label: "Sport et loisirs",
    osm: [
      { key: "leisure", values: ["fitness_centre", "sports_centre", "dance", "bowling_alley", "escape_game", "amusement_arcade", "miniature_golf", "trampoline_park", "horse_riding"] },
      { key: "amenity", values: ["dojo"] },
    ],
    google: ["gym"],
  },
  {
    id: "artisans",
    label: "Artisans et bâtiment",
    osm: [{ key: "craft" }],
    google: ["plumber", "electrician", "locksmith", "painter", "roofing_contractor", "moving_company"],
  },
  {
    id: "boutiques",
    label: "Boutiques (vêtements, fleurs, déco…)",
    osm: [{ key: "shop", exclude: [...FOOD_SHOPS, ...BEAUTY_SHOPS, ...HEALTH_SHOPS, ...AUTO_SHOPS, ...SERVICE_SHOPS, "vacant", "no"] }],
    google: [
      "clothing_store", "shoe_store", "jewelry_store", "florist", "book_store", "furniture_store",
      "home_goods_store", "pet_store", "electronics_store", "hardware_store", "bicycle_store",
    ],
  },
] as const satisfies readonly CategoryDef[];

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export type CategoryFilter = CategoryId | "tous";

const CATEGORY_DEFS: readonly CategoryDef[] = CATEGORIES;
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as string[]).includes(value);
}

export function getCategory(id: CategoryId): CategoryDef {
  return CATEGORY_DEFS.find((c) => c.id === id)!;
}

export function categoryLabel(id: CategoryId | null) {
  return id ? getCategory(id).label.replace(/ \(.*\)$/, "") : "Autre";
}

export function categoriesFor(filter: CategoryFilter): CategoryDef[] {
  return filter === "tous" ? [...CATEGORY_DEFS] : [getCategory(filter)];
}

/* ───────────── OpenStreetMap ───────────── */

export function osmRuleToOverpass(rule: OsmRule) {
  if (rule.values) return `["${rule.key}"~"^(${rule.values.join("|")})$"]`;
  if (rule.exclude) return `["${rule.key}"]["${rule.key}"!~"^(${rule.exclude.join("|")})$"]`;
  return `["${rule.key}"]`;
}

export function osmRuleMatches(rule: OsmRule, tags: Record<string, string>) {
  const value = tags[rule.key];
  if (!value) return false;
  if (rule.values) return rule.values.includes(value);
  if (rule.exclude) return !rule.exclude.includes(value);
  return true;
}

/** Catégorie d'un élément OpenStreetMap (la première qui correspond, dans l'ordre de CATEGORIES). */
export function categoryForOsmTags(tags: Record<string, string>): CategoryId | null {
  for (const category of CATEGORY_DEFS) {
    if (category.osm.some((rule) => osmRuleMatches(rule, tags))) return category.id as CategoryId;
  }
  return null;
}

/* ───────────── Google Places ───────────── */

/** Types Google à demander (50 au maximum par requête). */
export function googleTypesFor(filter: CategoryFilter): string[] {
  return [...new Set(categoriesFor(filter).flatMap((c) => c.google))];
}

export function categoryForGoogleTypes(types: string[]): CategoryId | null {
  for (const category of CATEGORY_DEFS) {
    if (category.google.some((t) => types.includes(t))) return category.id as CategoryId;
  }
  return null;
}

/* ───────────── Libellés des tags OpenStreetMap ───────────── */

const OSM_LABELS: Record<string, string> = {
  "amenity=restaurant": "Restaurant",
  "amenity=cafe": "Café",
  "amenity=bar": "Bar",
  "amenity=pub": "Pub",
  "amenity=fast_food": "Restauration rapide",
  "amenity=ice_cream": "Glacier",
  "amenity=biergarten": "Brasserie",
  "amenity=food_court": "Aire de restauration",
  "amenity=pharmacy": "Pharmacie",
  "amenity=dentist": "Dentiste",
  "amenity=doctors": "Cabinet médical",
  "amenity=clinic": "Clinique",
  "amenity=veterinary": "Vétérinaire",
  "amenity=car_wash": "Station de lavage",
  "amenity=car_rental": "Location de voitures",
  "amenity=driving_school": "Auto-école",
  "amenity=dojo": "Dojo",
  "healthcare=physiotherapist": "Kinésithérapeute",
  "healthcare=psychotherapist": "Psychothérapeute",
  "healthcare=optometrist": "Optométriste",
  "healthcare=podiatrist": "Podologue",
  "healthcare=alternative": "Médecine douce",
  "healthcare=audiologist": "Audioprothésiste",
  "healthcare=nurse": "Infirmier",
  "healthcare=speech_therapist": "Orthophoniste",
  "healthcare=laboratory": "Laboratoire",
  "healthcare=centre": "Centre de santé",
  "shop=bakery": "Boulangerie",
  "shop=butcher": "Boucherie",
  "shop=pastry": "Pâtisserie",
  "shop=cheese": "Fromagerie",
  "shop=deli": "Traiteur / épicerie fine",
  "shop=greengrocer": "Primeur",
  "shop=convenience": "Épicerie",
  "shop=wine": "Caviste",
  "shop=alcohol": "Magasin d'alcools",
  "shop=beverages": "Boissons",
  "shop=chocolate": "Chocolatier",
  "shop=confectionery": "Confiserie",
  "shop=seafood": "Poissonnerie",
  "shop=coffee": "Torréfacteur / café",
  "shop=tea": "Maison de thé",
  "shop=farm": "Produits de la ferme",
  "shop=organic": "Magasin bio",
  "shop=health_food": "Magasin bio / diététique",
  "shop=supermarket": "Supermarché",
  "shop=hairdresser": "Coiffeur",
  "shop=beauty": "Institut de beauté",
  "shop=cosmetics": "Cosmétiques",
  "shop=massage": "Massage",
  "shop=tattoo": "Tatoueur",
  "shop=perfumery": "Parfumerie",
  "shop=optician": "Opticien",
  "shop=hearing_aids": "Audioprothésiste",
  "shop=car": "Concessionnaire",
  "shop=car_repair": "Garage",
  "shop=car_parts": "Pièces auto",
  "shop=tyres": "Pneus",
  "shop=motorcycle": "Motos",
  "shop=dry_cleaning": "Pressing",
  "shop=laundry": "Laverie",
  "shop=travel_agency": "Agence de voyages",
  "shop=funeral_directors": "Pompes funèbres",
  "shop=copyshop": "Reprographie",
  "shop=photo": "Photographe",
  "shop=tailor": "Retouches / couture",
  "shop=locksmith": "Serrurier",
  "shop=repair": "Réparation",
  "shop=computer_repair": "Réparation informatique",
  "shop=shoe_repair": "Cordonnerie",
  "shop=clothes": "Vêtements",
  "shop=shoes": "Chaussures",
  "shop=florist": "Fleuriste",
  "shop=jewelry": "Bijouterie",
  "shop=books": "Librairie",
  "shop=furniture": "Meubles",
  "shop=interior_decoration": "Décoration",
  "shop=gift": "Cadeaux",
  "shop=hardware": "Quincaillerie",
  "shop=doityourself": "Bricolage",
  "shop=pet": "Animalerie",
  "shop=bicycle": "Vélos",
  "shop=mobile_phone": "Téléphonie",
  "shop=electronics": "Électronique",
  "shop=computer": "Informatique",
  "shop=sports": "Articles de sport",
  "shop=toys": "Jouets",
  "shop=newsagent": "Presse",
  "shop=tobacco": "Tabac",
  "shop=kiosk": "Kiosque",
  "shop=garden_centre": "Jardinerie",
  "shop=second_hand": "Dépôt-vente",
  "shop=variety_store": "Bazar",
  "shop=bag": "Maroquinerie",
  "shop=boutique": "Boutique",
  "shop=art": "Galerie d'art",
  "shop=music": "Musique",
  "shop=stationery": "Papeterie",
  "shop=bed": "Literie",
  "shop=kitchen": "Cuisines",
  "shop=houseware": "Arts de la table",
  "shop=e-cigarette": "Cigarette électronique",
  "office=estate_agent": "Agence immobilière",
  "office=lawyer": "Avocat",
  "office=accountant": "Expert-comptable",
  "office=insurance": "Assurance",
  "office=notary": "Notaire",
  "office=tax_advisor": "Conseil fiscal",
  "office=architect": "Architecte",
  "office=travel_agent": "Agence de voyages",
  "office=financial_advisor": "Conseil financier",
  "tourism=hotel": "Hôtel",
  "tourism=guest_house": "Chambre d'hôtes",
  "tourism=hostel": "Auberge de jeunesse",
  "tourism=motel": "Motel",
  "tourism=chalet": "Gîte / chalet",
  "tourism=apartment": "Location saisonnière",
  "leisure=fitness_centre": "Salle de sport",
  "leisure=sports_centre": "Centre sportif",
  "leisure=dance": "École de danse",
  "leisure=bowling_alley": "Bowling",
  "leisure=escape_game": "Escape game",
  "leisure=amusement_arcade": "Salle de jeux",
  "leisure=miniature_golf": "Minigolf",
  "leisure=trampoline_park": "Trampoline park",
  "leisure=horse_riding": "Centre équestre",
  "craft=plumber": "Plombier",
  "craft=electrician": "Électricien",
  "craft=carpenter": "Menuisier",
  "craft=joiner": "Menuisier",
  "craft=painter": "Peintre",
  "craft=roofer": "Couvreur",
  "craft=hvac": "Chauffagiste",
  "craft=locksmith": "Serrurier",
  "craft=builder": "Maçon / BTP",
  "craft=tiler": "Carreleur",
  "craft=gardener": "Paysagiste",
  "craft=photographer": "Photographe",
  "craft=shoemaker": "Cordonnier",
  "craft=tailor": "Couturier",
  "craft=dressmaker": "Couturière",
  "craft=confectionery": "Confiseur",
  "craft=caterer": "Traiteur",
  "craft=brewery": "Brasserie artisanale",
  "craft=winery": "Domaine viticole",
  "craft=jeweller": "Bijoutier",
  "craft=watchmaker": "Horloger",
  "craft=upholsterer": "Tapissier",
  "craft=glaziery": "Vitrier",
  "craft=metal_construction": "Métallier",
  "craft=stonemason": "Tailleur de pierre",
  "craft=blacksmith": "Forgeron",
  "craft=beekeeper": "Apiculteur",
  "craft=cleaning": "Nettoyage",
  "craft=window_construction": "Fenêtres",
  "craft=floorer": "Poseur de sols",
  "craft=plasterer": "Plâtrier",
  "craft=sculptor": "Sculpteur",
  "craft=pottery": "Potier",
};

const OSM_LABEL_KEYS = ["amenity", "healthcare", "shop", "office", "tourism", "leisure", "craft"];

/** Type lisible d'un élément OpenStreetMap : « Boulangerie », « Garage »… */
export function osmTypeLabel(tags: Record<string, string>) {
  for (const key of OSM_LABEL_KEYS) {
    const value = tags[key];
    if (!value) continue;
    const label = OSM_LABELS[`${key}=${value}`];
    if (label) return label;
  }
  for (const key of OSM_LABEL_KEYS) {
    const value = tags[key];
    if (value && value !== "yes") {
      const text = value.replace(/_/g, " ");
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
  }
  return "Commerce";
}
