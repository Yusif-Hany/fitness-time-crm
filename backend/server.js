const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

app.use(express.json());
app.use(cors());

require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY;

// =====================================================
// DATABASE
// =====================================================

const db = new sqlite3.Database('./fitness_crm.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// =====================================================
// CREATE TABLES
// =====================================================

db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      role TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      source TEXT,
      status TEXT,
      sales_man TEXT,
      comment TEXT,
      next_followup TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      username TEXT,
      action TEXT,
      date TEXT
    )
  `);

  // Create default admin
  db.get(
    `SELECT * FROM users WHERE username = ?`,
    ['admin'],
    (err, row) => {

      if (err) {
        console.error('Error checking admin:', err.message);
        return;
      }

      if (!row) {

        const hashedPassword = bcrypt.hashSync(
          'admin123',
          8
        );

        db.run(
          `INSERT INTO users
          (username, password, role)
          VALUES (?, ?, ?)`,
          [
            'admin',
            hashedPassword,
            'admin'
          ],
          (err) => {

            if (err) {
              console.error(
                'Error creating admin:',
                err.message
              );
            } else {
              console.log(
                'Default admin created: admin / admin123'
              );
            }

          }
        );
      }

    }
  );

});

// =====================================================
// JWT MIDDLEWARE
// =====================================================

function verifyToken(req, res, next) {

  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(403).json({
      error: 'No token provided'
    });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2) {
    return res.status(403).json({
      error: 'Invalid authorization format'
    });
  }

  const token = parts[1];

  jwt.verify(
    token,
    SECRET_KEY,
    (err, decoded) => {

      if (err) {
        return res.status(401).json({
          error: 'Failed to authenticate token'
        });
      }

      req.user = decoded;

      next();
    }
  );
}

// =====================================================
// ACTIVITY LOG
// =====================================================

function logActivity(
  leadId,
  username,
  action
) {

  const date = new Date().toISOString();

  db.run(
    `
    INSERT INTO activity_logs
    (lead_id, username, action, date)
    VALUES (?, ?, ?, ?)
    `,
    [
      leadId,
      username,
      action,
      date
    ],
    (err) => {

      if (err) {
        console.error(
          'Activity log error:',
          err.message
        );
      }

    }
  );
}

// =====================================================
// LOGIN
// =====================================================

app.post('/api/login', (req, res) => {

  const {
    username,
    password
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: 'Username and password are required'
    });
  }

  db.get(
    `SELECT * FROM users WHERE username = ?`,
    [username],
    (err, user) => {

      if (err) {
        console.error(
          'Login database error:',
          err.message
        );

        return res.status(500).json({
          error: 'Server error'
        });
      }

      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      const passwordIsValid =
        bcrypt.compareSync(
          password,
          user.password
        );

      if (!passwordIsValid) {
        return res.status(401).json({
          error: 'Invalid password'
        });
      }

      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          role: user.role
        },
        SECRET_KEY,
        {
          expiresIn: '8h'
        }
      );

      res.status(200).json({
        token,
        username: user.username,
        role: user.role
      });

    }
  );

});

// =====================================================
// USERS
// =====================================================

app.post('/api/users', verifyToken, (req, res) => {

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Unauthorized'
    });
  }

  const {
    username,
    password,
    role
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: 'Username and password are required'
    });
  }

  const hashedPassword =
    bcrypt.hashSync(password, 8);

  db.run(
    `
    INSERT INTO users
    (username, password, role)
    VALUES (?, ?, ?)
    `,
    [
      username,
      hashedPassword,
      role || 'sales'
    ],
    function (err) {

      if (err) {

        console.error(
          'Create user error:',
          err.message
        );

        return res.status(400).json({
          error: 'Username already exists'
        });
      }

      res.status(201).json({
        id: this.lastID,
        username,
        role: role || 'sales'
      });

    }
  );

});

// =====================================================
// DASHBOARD
// =====================================================

app.get('/api/dashboard', verifyToken, (req, res) => {

  db.get(
    `SELECT COUNT(*) as count FROM leads`,
    (err, leadRow) => {

      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }

      db.get(
        `SELECT COUNT(*) as count FROM employees`,
        (err, empRow) => {

          if (err) {
            return res.status(500).json({
              error: err.message
            });
          }

          const today =
            new Date()
              .toISOString()
              .split('T')[0];

          let query = `
            SELECT COUNT(*) as count
            FROM leads
            WHERE next_followup LIKE ?
          `;

          let params = [
            `${today}%`
          ];

          if (req.user.role === 'sales') {

            query += `
              AND (
                sales_man = ?
                OR sales_man = 'All Users'
              )
            `;

            params.push(
              req.user.username
            );
          }

          db.get(
            query,
            params,
            (err, followupRow) => {

              if (err) {
                return res.status(500).json({
                  error: err.message
                });
              }

              res.json({
                totalLeads:
                  leadRow
                    ? leadRow.count
                    : 0,

                totalEmployees:
                  empRow
                    ? empRow.count
                    : 0,

                todayFollowups:
                  followupRow
                    ? followupRow.count
                    : 0
              });

            }
          );

        }
      );

    }
  );

});

// =====================================================
// ANALYTICS
// =====================================================

app.get('/api/analytics', verifyToken, (req, res) => {

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Unauthorized'
    });
  }

  db.all(
    `SELECT name FROM employees`,
    [],
    (err, employees) => {

      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }

      db.all(
        `SELECT sales_man, status FROM leads`,
        [],
        (err, leads) => {

          if (err) {
            return res.status(500).json({
              error: err.message
            });
          }

          const stats =
            employees.map(emp => {

              const empLeads =
                leads.filter(
                  lead =>
                    lead.sales_man === emp.name
                );

              const totalAssigned =
                empLeads.length;

              const wonLeads =
                empLeads.filter(
                  lead =>
                    lead.status === 'Won'
                ).length;

              const conversionRate =
                totalAssigned > 0
                  ? (
                      (wonLeads /
                        totalAssigned) *
                      100
                    ).toFixed(1)
                  : 0;

              return {
                name: emp.name,
                totalAssigned,
                wonLeads,
                conversionRate
              };

            });

          res.json(stats);

        }
      );

    }
  );

});

// =====================================================
// GET LEADS
// =====================================================

app.get('/api/leads', verifyToken, (req, res) => {

  let query =
    `SELECT * FROM leads`;

  let params = [];

  if (req.user.role === 'sales') {

    query += `
      WHERE
        sales_man = ?
        OR sales_man = 'All Users'
    `;

    params.push(
      req.user.username
    );
  }

  db.all(
    query,
    params,
    (err, rows) => {

      if (err) {

        console.error(
          'Get leads error:',
          err.message
        );

        return res.status(500).json({
          error: err.message
        });
      }

      res.json(rows);

    }
  );

});

// =====================================================
// AUTO ASSIGN SALES
// =====================================================

async function getNextSalesman() {

  return new Promise((resolve) => {

    db.all(
      `SELECT name FROM employees`,
      [],
      (err, employees) => {

        if (
          err ||
          !employees ||
          employees.length === 0
        ) {
          return resolve('All Users');
        }

        db.all(
          `
          SELECT sales_man, COUNT(*) as count
          FROM leads
          GROUP BY sales_man
          `,
          [],
          (err, counts) => {

            if (err) {
              return resolve(
                employees[0].name
              );
            }

            let selected =
              employees[0].name;

            let minCount =
              Infinity;

            employees.forEach(
              emp => {

                const found =
                  counts.find(
                    c =>
                      c.sales_man ===
                      emp.name
                  );

                const count =
                  found
                    ? found.count
                    : 0;

                if (
                  count < minCount
                ) {

                  minCount = count;
                  selected = emp.name;

                }

              }
            );

            resolve(selected);

          }
        );

      }
    );

  });

}

// =====================================================
// CREATE LEAD
// =====================================================

app.post(
  '/api/leads',
  verifyToken,
  async (req, res) => {

    try {

      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Unauthorized'
        });
      }

      let {
        name,
        phone,
        source,
        status,
        sales_man,
        comment,
        next_followup
      } = req.body;

      console.log(
        'CREATE LEAD REQUEST:',
        req.body
      );

      if (!name || !phone) {

        return res.status(400).json({
          error:
            'Name and phone are required'
        });

      }

      if (
        sales_man ===
        'Auto (Round Robin)'
      ) {

        sales_man =
          await getNextSalesman();

      }

      const finalStatus =
        status || 'New';

      const finalSalesman =
        sales_man || 'All Users';

      const finalComment =
        comment || '';

      const finalFollowup =
        next_followup || null;

      db.run(
        `
        INSERT INTO leads
        (
          name,
          phone,
          source,
          status,
          sales_man,
          comment,
          next_followup
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          name,
          phone,
          source || '',
          finalStatus,
          finalSalesman,
          finalComment,
          finalFollowup
        ],
        function (err) {

          if (err) {

            console.error(
              'ERROR SAVING LEAD:',
              err.message
            );

            return res.status(500).json({
              error:
                err.message
            });

          }

          const leadId =
            this.lastID;

          logActivity(
            leadId,
            req.user.username,
            `Created lead assigned to ${finalSalesman}`
          );

          console.log(
            `Lead created successfully. ID: ${leadId}`
          );

          return res.status(201).json({
            id: leadId,
            message:
              'Lead saved successfully'
          });

        }
      );

    } catch (error) {

      console.error(
        'CREATE LEAD CRASH:',
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          'Error saving lead'
      });

    }

  }
);

// =====================================================
// UPDATE LEAD
// =====================================================

app.put(
  '/api/leads/:id',
  verifyToken,
  (req, res) => {

    const {
      name,
      phone,
      source,
      status,
      sales_man,
      comment,
      next_followup
    } = req.body;

    if (
      req.user.role === 'sales'
    ) {

      db.get(
        `SELECT * FROM leads WHERE id = ?`,
        [req.params.id],
        (err, lead) => {

          if (err) {
            return res.status(500).json({
              error: err.message
            });
          }

          if (
            !lead ||
            (
              lead.sales_man !==
              req.user.username &&
              lead.sales_man !==
              'All Users'
            )
          ) {

            return res.status(403).json({
              error: 'Unauthorized'
            });

          }

          db.run(
            `
            UPDATE leads
            SET
              status = ?,
              comment = ?,
              next_followup = ?
            WHERE id = ?
            `,
            [
              status,
              comment,
              next_followup,
              req.params.id
            ],
            function (err) {

              if (err) {
                return res.status(500).json({
                  error: err.message
                });
              }

              logActivity(
                req.params.id,
                req.user.username,
                `Updated status to ${status}`
              );

              res.json({
                updated:
                  this.changes
              });

            }
          );

        }
      );

    } else {

      db.run(
        `
        UPDATE leads
        SET
          name = ?,
          phone = ?,
          source = ?,
          status = ?,
          sales_man = ?,
          comment = ?,
          next_followup = ?
        WHERE id = ?
        `,
        [
          name,
          phone,
          source,
          status,
          sales_man,
          comment,
          next_followup,
          req.params.id
        ],
        function (err) {

          if (err) {
            return res.status(500).json({
              error: err.message
            });
          }

          logActivity(
            req.params.id,
            req.user.username,
            'Admin updated lead details'
          );

          res.json({
            updated:
              this.changes
          });

        }
      );

    }

  }
);

// =====================================================
// DELETE LEAD
// =====================================================

app.delete(
  '/api/leads/:id',
  verifyToken,
  (req, res) => {

    if (
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        error: 'Unauthorized'
      });
    }

    db.run(
      `DELETE FROM leads WHERE id = ?`,
      [req.params.id],
      function (err) {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          deleted:
            this.changes
        });

      }
    );

  }
);

// =====================================================
// ACTIVITY LOGS
// =====================================================

app.get(
  '/api/logs/:leadId',
  verifyToken,
  (req, res) => {

    db.all(
      `
      SELECT *
      FROM activity_logs
      WHERE lead_id = ?
      ORDER BY id DESC
      `,
      [req.params.leadId],
      (err, rows) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json(rows);

      }
    );

  }
);

// =====================================================
// EMPLOYEES
// =====================================================

app.get(
  '/api/employees',
  verifyToken,
  (req, res) => {

    db.all(
      `SELECT * FROM employees`,
      [],
      (err, rows) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json(rows);

      }
    );

  }
);

// CREATE EMPLOYEE

app.post(
  '/api/employees',
  verifyToken,
  (req, res) => {

    if (
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        error: 'Unauthorized'
      });
    }

    const {
      name,
      phone,
      role
    } = req.body;

    db.run(
      `
      INSERT INTO employees
      (name, phone, role)
      VALUES (?, ?, ?)
      `,
      [
        name,
        phone,
        role
      ],
      function (err) {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          id: this.lastID
        });

      }
    );

  }
);

// UPDATE EMPLOYEE

app.put(
  '/api/employees/:id',
  verifyToken,
  (req, res) => {

    if (
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        error: 'Unauthorized'
      });
    }

    const {
      name,
      phone,
      role
    } = req.body;

    db.run(
      `
      UPDATE employees
      SET
        name = ?,
        phone = ?,
        role = ?
      WHERE id = ?
      `,
      [
        name,
        phone,
        role,
        req.params.id
      ],
      function (err) {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          updated:
            this.changes
        });

      }
    );

  }
);

// DELETE EMPLOYEE

app.delete(
  '/api/employees/:id',
  verifyToken,
  (req, res) => {

    if (
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({
        error: 'Unauthorized'
      });
    }

    db.run(
      `DELETE FROM employees WHERE id = ?`,
      [req.params.id],
      function (err) {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          deleted:
            this.changes
        });

      }
    );

  }
);

// =====================================================
// FRONTEND
// =====================================================

const frontendPath =
  path.join(
    __dirname,
    '../frontend/dist'
  );

// Serve static frontend files
app.use(
  express.static(frontendPath)
);

// Send index.html for frontend routes
app.use(
  (req, res, next) => {

    if (
      !req.path.startsWith('/api')
    ) {

      return res.sendFile(
        path.join(
          frontendPath,
          'index.html'
        )
      );

    }

    next();

  }
);

// =====================================================
// SERVER
// =====================================================

app.listen(
  5000,
  '0.0.0.0',
  () => {

    console.log(
      'Server running on http://192.168.1.14:5000'
    );

  }
);