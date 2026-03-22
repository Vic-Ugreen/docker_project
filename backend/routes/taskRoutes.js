const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, contents, is_done, created_at
       FROM tasks
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Get tasks error:', error);
    return res.status(500).json({ message: 'Server error while fetching tasks' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  const { title, contents } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tasks (user_id, title, contents)
       VALUES ($1, $2, $3)
       RETURNING id, title, contents, is_done, created_at`,
      [req.user.id, title, contents || '']
    );

    return res.status(201).json({
      message: 'Task created successfully',
      task: result.rows[0],
    });
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({ message: 'Server error while creating task' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { title, contents, is_done } = req.body;

  if (title === undefined || title === null || title === '') {
    return res.status(400).json({ message: 'Title is required' });
  }

  try {
    const existingTask = await pool.query(
      'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existingTask.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const result = await pool.query(
      `UPDATE tasks
       SET title = $1,
           contents = $2,
           is_done = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, title, contents, is_done, created_at`,
      [title, contents || '', Boolean(is_done), id, req.user.id]
    );

    return res.json({
      message: 'Task updated successfully',
      task: result.rows[0],
    });
  } catch (error) {
    console.error('Update task error:', error);
    return res.status(500).json({ message: 'Server error while updating task' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    return res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({ message: 'Server error while deleting task' });
  }
});

module.exports = router;