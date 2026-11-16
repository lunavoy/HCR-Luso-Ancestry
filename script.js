const translations = {
  en: {
    title: "LusoAncestry | Discover your Portuguese roots",
    description: "Meet LusoAncestry, a collaborative project turning historical Portuguese records into searchable sources for family history.",
    navigation: "Main navigation",
    languages: "Language",
    skip: "Skip to content",
    how: "How it works",
    features: "Features",
    community: "Community",
    heritage: "Portuguese genealogy and heritage",
    discover: "Discover your",
    roots: "Portuguese roots",
    intro: "Explore your family history through baptism, marriage and death records preserved in Portuguese archives.",
    explore: "Explore the project",
    journey: "From manuscripts to family history",
    journeyIntro: "LusoAncestry brings together tools to read, review and organize historical Portuguese records.",
    transcribe: "Transcribe",
    transcribeIntro: "Handwriting recognition helps turn digitized pages into text.",
    review: "Review",
    reviewIntro: "Reviewers can check names, dates and places directly against the source.",
    research: "Research",
    researchIntro: "Structured records make it easier to search for people, places and events.",
    sourceTitle: "From discovery to the original source",
    sourceIntro: "The project connects genealogical information to the context in which it was recorded.",
    people: "People and events",
    peopleIntro: "Baptism, marriage and death records organized by name, date and place.",
    places: "Places of origin",
    placesIntro: "Geographic references help locate the places mentioned in the records.",
    documents: "Source references",
    documentsIntro: "Follow the link to the historical source to view the page and verify the information.",
    communityTitle: "Help preserve Portugal’s heritage",
    communityIntro: "Connect with people researching Portuguese genealogy, share discoveries and help review transcriptions.",
    discord: "Join us on Discord",
    photo: "Photo of Alfama",
    repository: "Code on GitHub",
    faqNav: "Frequently asked questions",
    participate: "Join the pilot",
    faqSoftware: "What will the software do for me?",
    faqSoftwareAnswer: "LusoAncestry helps read historical manuscripts and organize names, dates and places. This pilot focuses on reviewing the transcriptions that will be used to train handwriting recognition.",
    faqSignup: "How do I apply?",
    faqSignupAnswer: "Once applications open, you can share your contact details on this site. The team will email a registration link to selected participants.",
    faqTesting: "What will I do as a tester?",
    faqTestingAnswer: "You’ll compare transcriptions with images of the original records, correct readings where possible and flag uncertain passages. Your work will help prepare reliable examples for AI training.",
    faqExperience: "Do I need experience with manuscripts?",
    faqExperienceAnswer: "Beginners are welcome to apply. If you’ve researched genealogy or read historical manuscripts before, tell us a little about your experience in the form.",
    pilot: "Pilot program",
    pilotAvailability: "Applications will open when the testing workspace is ready. Follow the community for updates.",
    interestTitle: "Help validate transcriptions for AI training",
    interestIntro: "The pilot will focus on reviewing historical records to prepare training data.",
  },
  es: {
    title: "LusoAncestry | Descubre tus raíces portuguesas",
    description: "Conoce LusoAncestry, un proyecto colaborativo que convierte los registros históricos portugueses en fuentes para investigar tu historia familiar.",
    navigation: "Navegación principal",
    languages: "Idioma",
    skip: "Ir al contenido",
    how: "Cómo funciona",
    features: "Recursos",
    community: "Comunidad",
    heritage: "Genealogía y memoria portuguesa",
    discover: "Descubre tus",
    roots: "raíces portuguesas",
    intro: "Explora la historia de tu familia a través de registros de bautismo, matrimonio y defunción conservados en los archivos portugueses.",
    explore: "Explorar el proyecto",
    journey: "Del manuscrito a la historia familiar",
    journeyIntro: "LusoAncestry reúne herramientas para leer, revisar y organizar registros históricos portugueses.",
    transcribe: "Transcribir",
    transcribeIntro: "El reconocimiento de escritura manuscrita ayuda a convertir las páginas digitalizadas en texto.",
    review: "Revisar",
    reviewIntro: "La revisión de los registros permite comprobar nombres, fechas y lugares directamente en la fuente.",
    research: "Investigar",
    researchIntro: "Los datos se organizan para facilitar la búsqueda de personas, lugares y acontecimientos.",
    sourceTitle: "Del hallazgo a la fuente original",
    sourceIntro: "El proyecto conecta la información genealógica con el contexto en el que se registró.",
    people: "Personas y acontecimientos",
    peopleIntro: "Registros de bautismo, matrimonio y defunción organizados por nombre, fecha y localidad.",
    places: "Lugares de origen",
    placesIntro: "Referencias geográficas para ubicar las localidades mencionadas en los documentos.",
    documents: "Referencia documental",
    documentsIntro: "Enlace a la fuente histórica para consultar la página y comprobar la información.",
    communityTitle: "Ayuda a preservar la memoria de Portugal",
    communityIntro: "Conversa con quienes investigan la genealogía portuguesa, comparte descubrimientos y participa en la revisión de transcripciones.",
    discord: "Únete al Discord",
    photo: "Foto de Alfama",
    repository: "Código en GitHub",
    faqNav: "Preguntas frecuentes",
    participate: "Participar en las pruebas",
    faqSoftware: "¿Qué hará el software por mí?",
    faqSoftwareAnswer: "LusoAncestry ayuda a leer manuscritos históricos y organizar nombres, fechas y lugares. Esta fase se centra en revisar las transcripciones que se usarán para entrenar el reconocimiento de escritura.",
    faqSignup: "¿Cómo me inscribo?",
    faqSignupAnswer: "Cuando se abran las inscripciones, podrás dejar tus datos de contacto en este sitio. El equipo enviará un enlace de registro a las personas seleccionadas.",
    faqTesting: "¿Qué haré durante las pruebas?",
    faqTestingAnswer: "Compararás las transcripciones con las imágenes de los documentos originales, corregirás las lecturas cuando sea posible y señalarás los pasajes dudosos. Tu trabajo ayudará a preparar ejemplos fiables para entrenar la IA.",
    faqExperience: "¿Necesito experiencia con manuscritos?",
    faqExperienceAnswer: "Puedes postularte aunque estés empezando. Si has investigado genealogía o leído manuscritos históricos, cuéntanos un poco sobre tu experiencia.",
    pilot: "Fase de pruebas",
    pilotAvailability: "Las inscripciones se abrirán cuando esté disponible el entorno de pruebas. Sigue las novedades en la comunidad.",
    interestTitle: "Ayuda a validar transcripciones para entrenar la IA",
    interestIntro: "Las pruebas se centrarán en revisar documentos históricos para preparar los datos de entrenamiento.",
  },
};

const url = new URL(window.location.href);
const requestedLanguage = url.searchParams.get("lang");
const language = Object.hasOwn(translations, requestedLanguage) ? requestedLanguage : "pt";
const copy = translations[language];

if (copy) {
  document.documentElement.lang = language;
  document.title = copy.title;
  document.querySelector('meta[name="description"]').content = copy.description;
  document.querySelector('meta[property="og:title"]').content = copy.title;
  document.querySelector('meta[property="og:description"]').content = copy.description;
  document.querySelectorAll("[data-text]").forEach((element) => {
    element.textContent = copy[element.dataset.text];
  });
  document.querySelectorAll("[data-label]").forEach((element) => {
    element.setAttribute("aria-label", copy[element.dataset.label]);
  });
}

document.querySelectorAll(".languages a").forEach((link) => {
  if (link.lang === language) {
    link.setAttribute("aria-current", "true");
  } else {
    link.removeAttribute("aria-current");
  }

  link.addEventListener("click", () => {
    const destination = new URL(window.location.href);
    destination.searchParams.set("lang", link.lang);
    link.href = destination.href;
  });
});
