# Todo App API

Backend Express + MongoDB Atlas.

## Setup

1. Crie um cluster grátis no MongoDB Atlas.
2. Copie `server/.env.example` para `server/.env`.
3. Preencha `MONGODB_URI` e `JWT_SECRET`.
4. Rode:

```bash
npm --prefix server run dev
```

No celular físico, o app precisa acessar o IP da sua máquina na rede:

```env
EXPO_PUBLIC_API_URL=http://SEU_IP_DA_REDE:4000
```

No emulador Android, use:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
```

`CLOUDINARY_URL` é opcional. Sem ela, o avatar ainda funciona, mas fica salvo como data URL no MongoDB.
