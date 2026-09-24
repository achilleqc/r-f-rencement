/** Statuts du suivi commercial (partagés entre le serveur et le navigateur). */
export const PROSPECT_STATUSES = ["a_contacter", "contacte", "interesse", "client", "pas_interesse"] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const STATUS_LABELS: Record<ProspectStatus, string> = {
  a_contacter: "À contacter",
  contacte: "Contacté",
  interesse: "Intéressé",
  client: "Client",
  pas_interesse: "Pas intéressé",
};

/** Statuts pour lesquels une relance n'a plus de sens. */
export const CLOSED_STATUSES: ProspectStatus[] = ["client", "pas_interesse"];
