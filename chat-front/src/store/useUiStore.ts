// Состояние интерфейса, общее для разных компонентов (не данные с сервера)

import { create } from "zustand";

interface UiState {
  // Выдвижной список каналов на телефоне: кнопка открытия — в шапке чата, сама панель — в layout
  isChannelDrawerOpen: boolean;
  openChannelDrawer: () => void;
  closeChannelDrawer: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isChannelDrawerOpen: false,
  openChannelDrawer: () => set({ isChannelDrawerOpen: true }),
  closeChannelDrawer: () => set({ isChannelDrawerOpen: false }),
}));
