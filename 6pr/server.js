const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { ApolloServer, gql } = require('apollo-server-express');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = 3000;

const dataFilePath = path.join(__dirname, './products.json');

// ===== Swagger настройки =====
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Task Management API',
      version: '1.0.0',
      description: 'API для управления задачами',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
      },
    ],
  },
  apis: [ 'openapi.yaml' ],
};
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ===== Middleware =====
app.use(bodyParser.json());

// ===== Чтение/запись данных в JSON =====
function readData() {
  try {
    const data = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}
function writeData(data) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
}

// ===== Статические файлы (фронтенд) =====
// Допустим, ваш каталог с клиентским приложением (index.html + style.css) — это ../5pr
app.use(express.static(path.join(__dirname, '../5pr')));

// Если пользователь переходит на корень, отдаём страницу покупателя
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../5pr/index.html'));
});

// Если переходим на /admin, отдаём страницу админа
app.get('/admin', (req, res) => {
  // Считаем, что admin.html лежит в той же папке, что и server.js
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ===== REST-эндпойнты для продуктов =====
let products = readData();

// Получить все товары
app.get('/products', (req, res) => {
  res.json(products);
});

// Добавить товар
app.post('/products', (req, res) => {
  const newProduct = {
    id: products.length > 0 ? products[products.length - 1].id + 1 : 1,
    name: req.body.name,
    price: req.body.price,
    description: req.body.description,
    categories: req.body.categories
  };
  products.push(newProduct);
  writeData(products);
  res.status(201).json(newProduct);
});

// Получить товар по ID
app.get('/products/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const product = products.find(p => p.id === productId);
  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ message: 'Product not found' });
  }
});

// Обновить товар
app.put('/products/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const product = products.find(p => p.id === productId);
  if (product) {
    product.name = req.body.name ?? product.name;
    product.price = req.body.price ?? product.price;
    product.description = req.body.description ?? product.description;
    product.categories = req.body.categories ?? product.categories;
    writeData(products);
    res.json(product);
  } else {
    res.status(404).json({ message: 'Product not found' });
  }
});

// Удалить товар
app.delete('/products/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const newProducts = products.filter(p => p.id !== productId);
  if (newProducts.length !== products.length) {
    products = newProducts;
    writeData(products);
    res.status(204).send();
  } else {
    res.status(404).json({ message: 'Product not found' });
  }
});

// ===== GraphQL: схема и сервер Apollo =====
const typeDefs = gql`
  type Product {
    id: ID!
    name: String
    price: Float
    description: String
    categories: [String]
  }

  type Query {
    products: [Product]
    product(id: ID!): Product
  }
`;

const resolvers = {
  Query: {
    products: () => {
      // Возвращаем все продукты
      return products;
    },
    product: (parent, args) => {
      // Возвращаем конкретный продукт
      return products.find(p => p.id === parseInt(args.id));
    },
  },
};

async function startApolloServer() {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });
}
startApolloServer();

// ===== Запуск HTTP-сервера и WebSocket-сервера =====
const serverHttp = app.listen(PORT, () => {
  console.log(`HTTP Server running on http://localhost:${PORT}`);
  console.log(`GraphQL endpoint on http://localhost:${PORT}/graphql`);
  console.log(`Swagger docs on http://localhost:${PORT}/api-docs`);
});

// ===== WebSocket-сервер (чат) =====
const wss = new WebSocketServer({ server: serverHttp });
let connections = [];

wss.on('connection', (ws) => {
  connections.push(ws);
  console.log('Новый клиент WebSocket подключился');

  // Событие при получении сообщения
  ws.on('message', (message) => {
    console.log('Получено сообщение из WS:', message.toString());
    // Рассылаем всем участникам чата
    connections.forEach(client => {
      if (client.readyState === 1) {
        client.send(message.toString());
      }
    });
  });

  // Событие при закрытии соединения
  ws.on('close', () => {
    console.log('Клиент WebSocket отключился');
    connections = connections.filter(conn => conn !== ws);
  });
});
