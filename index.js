import express from "express";
import bodyParser from 'body-parser';
import pg from 'pg';
import axios from 'axios';
import ejs from 'ejs';
import bcrypt from 'bcrypt'
import session from 'express-session'
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;
const URL = 'https://api.themoviedb.org/3/search/movie';
const APIKey = process.env.TMDB_API_KEY;
const saltRounds = 10;

app.use(session({
    secret: process.env.SESSION_KEY,
    saveUninitialized: true,
    resave: false
}))

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

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if(err){
            console.log(err);
        }
        res.redirect('/');
    })
})


app.get('/movies', async (req, res) => {
    if(req.session.userId){
        const data = await db.query('SELECT * FROM movies WHERE user_id = $1', [req.session.userId]);
        const moviesAdded = data.rows;
        res.render('index.ejs', {data: moviesAdded});
    } else {
        res.redirect('/');
    }
})

app.post('/register', async (req,res) => {
    const email = req.body.emailReg;
    const password = req.body.passwordReg;
    try {
        const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if(user.rows.length > 0){
            res.redirect('/')
        } else {
            const hash = await bcrypt.hash(password, saltRounds)
                const result = await db.query('INSERT INTO users (email, password) VALUES ($1,$2) RETURNING *', [email,hash])
                req.session.userId = result.rows[0].id;
                res.redirect('/movies')
        }
    } catch (err) {
        console.log(err);
    }
});


app.post('/login', async(req,res) => {
    const email = req.body.emailLog;
    const password = req.body.passwordLog;

    try {
        const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if(user.rows.length > 0){
            const hashed = user.rows[0].password;
                if(await bcrypt.compare(password, hashed)){
                    req.session.userId = user.rows[0].id;
                    res.redirect('/movies')
                } else {
                    res.redirect('/')
                }
        } else {
            res.send('Incorrect Email')
        }
    } catch (err) {
        console.log(err);
    }
    
})

app.post('/add', async (req, res) => {
    const normalTitle = req.body.movie;
    const movieTitle = normalTitle.split(' ')
    .map(w => w[0].toUpperCase() + w.substring(1).toLowerCase())
    .join(' ');
    const result = await axios.get(URL + `?api_key=${APIKey}&query=${movieTitle}`);
    const movie = result.data.results.find(movie => movie.title == movieTitle);
    const selectedMovie = movie || result.data.results[0];
    if (!selectedMovie) {
      return res.send("Movie not found!");
    } else {
        res.render('movie.ejs', {title: selectedMovie.title, link: selectedMovie.poster_path, review: '', rating: ''});
    }
})

app.post('/submit', async (req, res) => {
    const review = req.body.review;
    const rating = req.body.rating;
    const movieName = req.body.name;
    const result = await axios.get(URL + `?api_key=${APIKey}&query=${movieName}`);
    const movie = result.data.results.find(movie => movie.title == movieName);
    const data = await db.query('SELECT * FROM movies WHERE name = $1 AND user_id = $2', [movieName, req.session.userId])
    if(data.rows.length > 0){
        res.redirect('/movies');
    }else{
    await db.query('INSERT INTO movies (name, image, user_id ) VALUES ($1, $2, $3)', [movie.title, movie.poster_path, req.session.userId]);
    await db.query('UPDATE movies SET review = ($1), rating = ($2) WHERE name = ($3)', [review, rating, movie.title]);
    res.redirect('/movies');
    }
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



