// Анонимность: имя автора для всех одинаковое. Приватные данные (user_id, имя, email, username)
// вообще не попадают в ответы API — скрывать их на frontend не нужно, их там просто нет.

import type { AuthorDto } from "../types/dto";

export const ANONYMOUS_NAME = "Анонимно";

export const ANONYMOUS_AUTHOR: AuthorDto = Object.freeze({ displayName: ANONYMOUS_NAME });
