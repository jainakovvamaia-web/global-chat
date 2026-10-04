// Анонимное отображение авторов. Сервер вообще не присылает данных о других людях:
// у сообщения есть только author.displayName = «Анонимно» и флаг isMine.

export const ANONYMOUS_NAME = "Анонимно";

// Полное имя владельца профиля — показывается только ему самому (в профиле и настройках)
export const getFullName = (profile: { firstName: string; lastName: string }) =>
  `${profile.firstName} ${profile.lastName}`.trim();
