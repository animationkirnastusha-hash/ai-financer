export type TelegramBotUser = {
  id?: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type TelegramBotMessage = {
  message_id?: number;
  text?: string;
  caption?: string;
  chat?: {
    id?: number | string;
    type?: string;
  };
  from?: TelegramBotUser;
};

export type TelegramBotCallbackQuery = {
  id?: string;
  data?: string;
  from?: TelegramBotUser;
  message?: {
    message_id?: number;
    chat?: {
      id?: number | string;
      type?: string;
    };
  };
};

export type TelegramBotUpdate = {
  update_id?: number;
  message?: TelegramBotMessage;
  edited_message?: TelegramBotMessage;
  callback_query?: TelegramBotCallbackQuery;
};
