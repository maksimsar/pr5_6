const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs')

const app = express();
const PORT = 3000;

const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const dataFilePath = path.join(__dirname, './products.json');


// Swagger документация
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
                url: 'http://localhost:3000',
            },
        ],
    },
    apis: ['openapi.yaml'], // укажите путь к файлам с аннотациями
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Middleware для парсинга JSON
app.use(bodyParser.json());

// Функция для чтения данных из JSON
const readData = () => {
    try {
        const data = fs.readFileSync(dataFilePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return []; // Если файла нет, возвращаем пустой массив
    }
};

// Функция для записи данных в JSON
const writeData = (data) => {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
};

app.use(express.static(path.join(__dirname, '../Practice5')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../Practice5/index.html'));
});

app.get('/admin',(req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'admin.html'));
});

// Инициализация данных
let products = readData();

// Получение всех товаров
app.get('/products', (req, res) => {
    res.json(products);
});

// Добавление нового товара
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

// Получение товара по ID
app.get('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const product = products.find(p => p.id === productId);
    if (product) {
        res.json(product);
    } else {
        res.status(404).json({ message: 'Product not found' });
    }
});

// Обновление товара по ID
app.put('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const product = products.find(p => p.id === productId);
    if (product) {
        product.name = req.body.name !== undefined ? req.body.name : product.name;
        product.price = req.body.price !== undefined ? req.body.price : product.price;
        product.category = req.body.category !== undefined ? req.body.category : product.category;
        writeData(products); // Сохраняем изменения в JSON
        res.json(product);
    } else {
        res.status(404).json({ message: 'Product not found' });
    }
});

// Удаление товара по ID
app.delete('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const newProducts = products.filter(p => p.id !== productId);
    if (newProducts.length !== products.length) {
        products = newProducts;
        writeData(products); // Сохраняем изменения в JSON
        res.status(204).send();
    } else {
        res.status(404).json({ message: 'Product not found' });
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));