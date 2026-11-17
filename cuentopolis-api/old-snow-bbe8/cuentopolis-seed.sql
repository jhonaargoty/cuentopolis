CREATE TABLE IF NOT EXISTS story_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL,
  page INTEGER NOT NULL,
  word TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_story_resources_story_page
  ON story_resources(story_id, page);

INSERT INTO stories (id, title, description, cover, content, audio_triggers)
VALUES (
  1,
  'El pequeño elefante',
  'Una aventura de un pequeño elefante que descubre la selva.',
  'https://lh3.googleusercontent.com/d/1sw-ljXXsqxNSlad39JmW-nhnUV5gz8J0=w1200',
  'Había una vez un pequeño elefante llamado Tito.

Tito vivía con su familia en una enorme selva llena de árboles, ríos y animales.

Un día decidió salir a explorar. Caminó durante mucho tiempo hasta encontrar un pequeño río.

En el río conoció a una rana que necesitaba ayuda para regresar a su casa.

Tito decidió ayudarla y juntos emprendieron el camino de regreso.

Al final del día, Tito volvió con su familia muy feliz por la aventura que había vivido.',
  '[
    {
      "words": ["elefante", "Tito"],
      "audioUrl": "https://drive.google.com/uc?export=download&id=1AHtiAIA3UGKm2P4xufj_Cq2xSg5K43U9",
      "enabled": true
    },
    {
      "words": ["rana"],
      "audioUrl": "https://drive.google.com/uc?export=download&id=1j3aBMtyA2mYDX4T8mx9CWTdSaoNqv9AF",
      "enabled": true
    },
    {
      "words": ["río", "agua"],
      "audioUrl": "https://drive.google.com/uc?export=download&id=1Tfaije4JJEoyTMIKybJuftOWGxajAxnL",
      "enabled": true
    },
    {
      "words": ["selva", "árboles", "pájaros"],
      "audioUrl": "https://drive.google.com/uc?export=download&id=1nF0LmV9Xdm7wbopZHSgQp9I2hvtFZLUy",
      "enabled": true
    }
  ]'
);

INSERT INTO stories (id, title, description, cover, content, audio_triggers)
VALUES (
  2,
  'La rana y la luna',
  'Una pequeña rana tiene una idea muy especial para alcanzar la luna.',
  'https://lh3.googleusercontent.com/d/1dP7JEdWMJoZI7pVnwSoEKJgAABfMyI5X=w1200',
  'Una noche, una pequeña rana salió de su casa y miró hacia el cielo.

La luna brillaba más que nunca.

La rana pensó que sería maravilloso poder tocarla.

Saltó una vez.

Saltó dos veces.

Pero la luna seguía muy lejos.

Entonces la rana tuvo una gran idea.

Buscó a sus amigos y juntos construyeron una pequeña torre de piedras.

Cuando terminaron, la rana subió hasta lo más alto y miró nuevamente la luna.

Aunque todavía estaba lejos, comprendió que algunas cosas no necesitan tocarse para hacernos felices.',
  '[]'
);

INSERT INTO story_resources (story_id, page, word, audio_url) VALUES (1, 0, 'elefante', 'https://drive.google.com/uc?export=download&id=1AHtiAIA3UGKm2P4xufj_Cq2xSg5K43U9');
INSERT INTO story_resources (story_id, page, word, audio_url) VALUES (1, 0, 'Tito', 'https://drive.google.com/uc?export=download&id=1AHtiAIA3UGKm2P4xufj_Cq2xSg5K43U9');
INSERT INTO story_resources (story_id, page, word, audio_url) VALUES (1, 0, 'selva', 'https://drive.google.com/uc?export=download&id=1nF0LmV9Xdm7wbopZHSgQp9I2hvtFZLUy');
INSERT INTO story_resources (story_id, page, word, audio_url) VALUES (1, 0, 'árboles', 'https://drive.google.com/uc?export=download&id=1nF0LmV9Xdm7wbopZHSgQp9I2hvtFZLUy');
INSERT INTO story_resources (story_id, page, word, audio_url) VALUES (1, 1, 'río', 'https://drive.google.com/uc?export=download&id=1Tfaije4JJEoyTMIKybJuftOWGxajAxnL');
INSERT INTO story_resources (story_id, page, word, audio_url) VALUES (1, 2, 'Tito', 'https://drive.google.com/uc?export=download&id=1AHtiAIA3UGKm2P4xufj_Cq2xSg5K43U9');
INSERT INTO story_resources (story_id, page, word, audio_url) VALUES (1, 2, 'rana', 'https://drive.google.com/uc?export=download&id=1j3aBMtyA2mYDX4T8mx9CWTdSaoNqv9AF');
INSERT INTO story_resources (story_id, page, word, audio_url) VALUES (1, 2, 'río', 'https://drive.google.com/uc?export=download&id=1Tfaije4JJEoyTMIKybJuftOWGxajAxnL');
INSERT INTO story_resources (story_id, page, word, audio_url) VALUES (1, 3, 'Tito', 'https://drive.google.com/uc?export=download&id=1AHtiAIA3UGKm2P4xufj_Cq2xSg5K43U9');
