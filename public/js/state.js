export const state = {
  user: null,
  settings: { restaurant_name: 'Restaurant', currency: 'FCFA' },
};

export const ROLE_LABELS = {
  proprietaire: 'Propriétaire',
  gerant: 'Gérant',
};

export const isOwner = () => state.user?.role === 'proprietaire';
