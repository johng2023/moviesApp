import express from "express";
import bodyParser from 'body-parser';
import pg from 'pg';
import axios from 'axios';
import ejs from 'ejs';
import bcrypt from 'bcrypt'
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;
const URL = 'https://api.themoviedb.org/3/discover/movie';
const APIKey = process.env.TMDB_API_KEY;

const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT)
});

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req,res) => {
    res.render('home.ejs')
})


app.get('/movies', async (req, res) => {
    const result = await axios.get(URL + `?api_key=${APIKey}`);
    const movies = result.data.results;
    const data = await db.query('SELECT * FROM movies ORDER BY id ASC');
    const moviesAdded = data.rows;
    res.render('index.ejs', {movies : movies, data: moviesAdded});
})

app.post('/register', (req,res) => {
    res.redirect('/movies')
})

app.post('/login', (req,res) => {
    res.redirect('/movies')
})

app.post('/add', async (req, res) => {
    const movieTitle = req.body.movie;
    const result = await axios.get(URL + `?api_key=${APIKey}`);
    const movie = result.data.results.find(movie => movie.title == movieTitle);
    await db.query('INSERT INTO movies (name, image) VALUES ($1, $2)', [movie.title, movie.poster_path])
    res.render('movie.ejs', {title: movieTitle, link: movie.poster_path, review: '', rating: ''});
})

app.post('/submit', async (req, res) => {
    const review = req.body.review;
    const rating = req.body.rating;
    const movieName = req.body.name;
    await db.query('UPDATE movies SET review = ($1), rating = ($2) WHERE name = ($3)', [review, rating, movieName])
    res.redirect('/movies');
})

app.post("/edit", async (req, res) => {
    const name = req.body.editItemId;
    const data = await db.query('SELECT * FROM movies WHERE name = ($1)', [name])
    const movieData = data.rows[0];
    res.render('movie.ejs', {link:  movieData.image, review: movieData.review, rating: movieData.rating , title: name});
  });

app.post("/delete", async (req, res) => {
    const itemToDelete = req.body.deleteItemId;
    await db.query('DELETE FROM movies WHERE name = $1', [itemToDelete])
    res.redirect('/movies')
  });

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
})



