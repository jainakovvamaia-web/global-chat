// Логика зависимых списков «город → район → тип → учебное заведение».
// Сами списки приходят с сервера (useCities / useDistricts / useInstitutions),
// а совместимость значений окончательно проверяет сервер.

import type { Institution, InstitutionType, LocationSelection } from "@/types";

export const EMPTY_LOCATION: LocationSelection = {
  cityId: "",
  districtId: "",
  institutionType: "",
  institutionId: "",
};

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  school: "Школа",
  university: "Университет",
};

// Подпись в списке: «КНУ им. Ж. Баласагына — Кыргызский национальный университет»
export const getInstitutionLabel = (institution: Institution) =>
  institution.fullName ? `${institution.name} — ${institution.fullName}` : institution.name;

// Изменение одного поля с автоматическим сбросом всего, что от него зависело.
// Так в форме никогда не остаётся несовместимых значений (район чужого города и т.п.).
export function changeLocation<K extends keyof LocationSelection>(
  previous: LocationSelection,
  field: K,
  value: LocationSelection[K],
): LocationSelection {
  const next = { ...previous, [field]: value };
  if (field === "cityId") {
    next.districtId = "";
    next.institutionId = "";
  }
  if (field === "districtId" || field === "institutionType") {
    next.institutionId = "";
  }
  return next;
}

export type LocationErrors = Partial<Record<keyof LocationSelection, string>>;

// Город и район обязательны; если выбран тип учебного заведения, нужно выбрать и само заведение
export function validateLocation(selection: LocationSelection): LocationErrors {
  const errors: LocationErrors = {};
  if (!selection.cityId) errors.cityId = "Выберите город";
  if (!selection.districtId) errors.districtId = "Выберите район";
  if (selection.institutionType && !selection.institutionId) {
    errors.institutionId = "Выберите учебное заведение или сбросьте тип";
  }
  return errors;
}
