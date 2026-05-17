# TaskHub ✅

TaskHub é um app mobile de tarefas colaborativas feito com Expo, React Native e um backend Express com MongoDB.

## ✨ Funcionalidades

- 🔐 Cadastro e login com autenticação JWT
- 👤 Avatar de usuário com upload opcional para Cloudinary
- ✅ Criação, edição, conclusão e exclusão de tarefas
- 👥 Tarefas atribuídas para você e tarefas que você designou
- 🔎 Busca, filtros por status e ordenação por prioridade/data
- 🔔 Notificações push e lembretes locais
- 📡 Atualização em tempo real com Socket.IO
- 🕘 Histórico de atividades por tarefa
- 🌙 Tema claro/escuro persistente

## 🧰 Stack

- Expo + React Native
- TypeScript
- NativeWind/Tailwind
- Express
- MongoDB Atlas + Mongoose
- Socket.IO
- JWT
- Cloudinary opcional

## 🚀 Como rodar

Instale as dependências:

```bash
npm install
npm --prefix server install
```

Configure o backend:

```bash
cp server/.env.example server/.env
```

Preencha `MONGODB_URI` e `JWT_SECRET` em `server/.env`.

Rode a API:

```bash
npm run server
```

Configure a URL da API no `.env` da raiz:

```env
EXPO_PUBLIC_API_URL=http://SEU_IP_DA_REDE:4000
```

Rode o app:

```bash
npm start
```

## 🔒 Segurança

Arquivos `.env` reais não devem ir para o GitHub. Use apenas `server/.env.example` como modelo.
