// A MOCK-UP. Templates for events are not built yet (chapter 14 of PRODUKTDOKUMENTASJON.md,
// «Arrangement, maler og serier», step B). Until they are, the form for an event offers these
// fixed examples, so the place of a template in the form can be seen and tried. Choosing one
// fills in a few fields and nothing more: it is not stored, and has no staffing or run sheet.
//
// The product owner asked for the mock-up to stand in the form itself (12 October 2026). The
// form says that it is one. When step B is built, this file goes, and the form reads the
// congregation's own templates.

export interface TemplateMockup {
  id: string;
  name: string;
  /** How often such an event is held, as the template says it. */
  rhythm: string;
  title: string;
  time: string;
  endTime: string;
  isGudstjeneste: boolean;
}

export const TEMPLATE_MOCKUPS: readonly TemplateMockup[] = [
  { id: "gudstjeneste", name: "Gudstjeneste", rhythm: "Hver søndag kl. 11:00", title: "Gudstjeneste", time: "11:00", endTime: "12:30", isGudstjeneste: true },
  { id: "utegudstjeneste", name: "Utegudstjeneste", rhythm: "Ved behov", title: "Utegudstjeneste", time: "12:00", endTime: "13:30", isGudstjeneste: true },
  { id: "konfirmasjon", name: "Konfirmasjon", rhythm: "Årlig", title: "Konfirmasjonsgudstjeneste", time: "11:00", endTime: "13:00", isGudstjeneste: true },
  { id: "kulturkveld", name: "Kulturkveld", rhythm: "Årlig", title: "Kulturkveld", time: "18:00", endTime: "21:00", isGudstjeneste: false },
];
