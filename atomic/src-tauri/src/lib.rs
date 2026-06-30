mod tray;

use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};
use tauri_plugin_window_state::{StateFlags, WindowExt};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_tasks_table",
            sql: "CREATE TABLE IF NOT EXISTS tasks (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT NOT NULL,
                description TEXT,
                category    TEXT CHECK(category IN ('work','personal','health','learn')),
                priority    TEXT CHECK(priority IN ('high','mid','low')) DEFAULT 'mid',
                reminder    TEXT,
                date        TEXT NOT NULL,
                is_done     INTEGER DEFAULT 0,
                created_at  TEXT DEFAULT (datetime('now'))
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_goals_table",
            sql: "CREATE TABLE IF NOT EXISTS goals (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT NOT NULL,
                description TEXT,
                category    TEXT CHECK(category IN ('work','personal','health','learn')),
                priority    TEXT CHECK(priority IN ('high','mid','low')) DEFAULT 'mid',
                year        INTEGER NOT NULL,
                quarter     TEXT CHECK(quarter IN ('Q1','Q2','Q3','Q4','full')),
                status      TEXT CHECK(status IN ('todo','doing','review','done')) DEFAULT 'todo',
                progress    INTEGER DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
                position    INTEGER DEFAULT 0,
                created_at  TEXT DEFAULT (datetime('now'))
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_goal_checklist_items",
            sql: "CREATE TABLE IF NOT EXISTS goal_checklist_items (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                goal_id  INTEGER NOT NULL,
                text     TEXT NOT NULL,
                is_done  INTEGER NOT NULL DEFAULT 0,
                position INTEGER NOT NULL DEFAULT 0
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create_category_colors",
            sql: "CREATE TABLE IF NOT EXISTS category_colors (
                category TEXT PRIMARY KEY,
                color    TEXT NOT NULL
            );
            INSERT OR IGNORE INTO category_colors (category, color) VALUES
                ('work',     '#7DD3FC'),
                ('personal', '#86EFAC'),
                ('health',   '#FDBA74'),
                ('learn',    '#C4B5FD');",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_repeat_daily_to_tasks",
            sql: "ALTER TABLE tasks ADD COLUMN repeat_daily INTEGER NOT NULL DEFAULT 0;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "create_task_time_entries",
            sql: "CREATE TABLE IF NOT EXISTS task_time_entries (
                task_id    INTEGER NOT NULL,
                date       TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time   TEXT NOT NULL,
                PRIMARY KEY (task_id, date)
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "create_tags_and_task_tags",
            sql: "CREATE TABLE IF NOT EXISTS tags (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL,
                color      TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS task_tags (
                task_id INTEGER NOT NULL,
                tag_id  INTEGER NOT NULL,
                PRIMARY KEY (task_id, tag_id)
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "expand_category_check_constraint",
            sql: "PRAGMA foreign_keys = OFF;
            ALTER TABLE tasks RENAME TO tasks_old;
            CREATE TABLE tasks (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                title        TEXT NOT NULL,
                description  TEXT,
                category     TEXT CHECK(category IN ('work','personal','health','learn','creative','mindfulness','finance')),
                priority     TEXT CHECK(priority IN ('high','mid','low')) DEFAULT 'mid',
                reminder     TEXT,
                date         TEXT NOT NULL,
                is_done      INTEGER DEFAULT 0,
                created_at   TEXT DEFAULT (datetime('now')),
                repeat_daily INTEGER NOT NULL DEFAULT 0
            );
            INSERT INTO tasks SELECT * FROM tasks_old;
            DROP TABLE tasks_old;
            ALTER TABLE goals RENAME TO goals_old;
            CREATE TABLE goals (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT NOT NULL,
                description TEXT,
                category    TEXT CHECK(category IN ('work','personal','health','learn','creative','mindfulness','finance')),
                priority    TEXT CHECK(priority IN ('high','mid','low')) DEFAULT 'mid',
                year        INTEGER NOT NULL,
                quarter     TEXT CHECK(quarter IN ('Q1','Q2','Q3','Q4','full')),
                status      TEXT CHECK(status IN ('todo','doing','review','done')) DEFAULT 'todo',
                progress    INTEGER DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
                position    INTEGER DEFAULT 0,
                created_at  TEXT DEFAULT (datetime('now'))
            );
            INSERT INTO goals SELECT * FROM goals_old;
            DROP TABLE goals_old;
            PRAGMA foreign_keys = ON;
            INSERT OR IGNORE INTO category_colors (category, color) VALUES
                ('creative',    '#F9A8D4'),
                ('mindfulness', '#6EE7B7'),
                ('finance',     '#FDE68A');",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "add_series_fields_to_tasks",
            sql: "ALTER TABLE tasks ADD COLUMN series_id INTEGER DEFAULT NULL;
            ALTER TABLE tasks ADD COLUMN repeat_end_date TEXT DEFAULT NULL;
            UPDATE tasks SET repeat_daily = 0
            WHERE repeat_daily = 1 AND is_done = 0
              AND id != (
                SELECT t2.id FROM tasks t2
                WHERE t2.repeat_daily = 1 AND t2.is_done = 0
                  AND t2.title = tasks.title AND t2.category = tasks.category
                ORDER BY t2.date DESC, t2.id ASC
                LIMIT 1
              );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "create_journal_entries",
            sql: "CREATE TABLE IF NOT EXISTS journal_entries (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                date       TEXT NOT NULL,
                type       TEXT NOT NULL CHECK(type IN ('gratitude','lesson')),
                items      TEXT NOT NULL DEFAULT '[]',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date, type);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "add_color_to_tasks",
            sql: "ALTER TABLE tasks ADD COLUMN color TEXT DEFAULT NULL;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "create_weekly_checklist",
            sql: "CREATE TABLE IF NOT EXISTS weekly_checklist (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                week_key   TEXT NOT NULL,
                text       TEXT NOT NULL,
                is_done    INTEGER NOT NULL DEFAULT 0,
                position   INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_weekly_checklist_week ON weekly_checklist(week_key);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "create_vocab_words",
            sql: "CREATE TABLE IF NOT EXISTS vocab_words (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                word       TEXT NOT NULL,
                ipa        TEXT NOT NULL DEFAULT '',
                meaning    TEXT NOT NULL,
                position   INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "vocab_words_add_pos_meaning_en",
            sql: "ALTER TABLE vocab_words ADD COLUMN part_of_speech TEXT NOT NULL DEFAULT '';
                  ALTER TABLE vocab_words ADD COLUMN meaning_en TEXT NOT NULL DEFAULT '';",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "create_quotes_tables",
            sql: "CREATE TABLE IF NOT EXISTS quotes (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                text        TEXT NOT NULL,
                author      TEXT DEFAULT NULL,
                language    TEXT NOT NULL DEFAULT 'EN',
                is_favorite INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS quote_tags (
                quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
                tag      TEXT NOT NULL,
                PRIMARY KEY (quote_id, tag)
            );
            PRAGMA foreign_keys = ON;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "add_other_category",
            sql: "PRAGMA foreign_keys = OFF;
            ALTER TABLE tasks RENAME TO tasks_old;
            CREATE TABLE tasks (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                title           TEXT NOT NULL,
                description     TEXT,
                category        TEXT CHECK(category IN ('work','personal','health','learn','creative','mindfulness','finance','other')),
                priority        TEXT CHECK(priority IN ('high','mid','low')) DEFAULT 'mid',
                reminder        TEXT,
                date            TEXT NOT NULL,
                is_done         INTEGER DEFAULT 0,
                created_at      TEXT DEFAULT (datetime('now')),
                repeat_daily    INTEGER NOT NULL DEFAULT 0,
                series_id       INTEGER DEFAULT NULL,
                repeat_end_date TEXT DEFAULT NULL,
                color           TEXT DEFAULT NULL
            );
            INSERT INTO tasks SELECT * FROM tasks_old;
            DROP TABLE tasks_old;
            PRAGMA foreign_keys = ON;
            INSERT OR IGNORE INTO category_colors (category, color) VALUES ('other', '#9E9E9E');",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "deduplicate_daily_instances_and_add_unique_index",
            sql: "DELETE FROM task_tags WHERE task_id IN (
                SELECT id FROM tasks WHERE series_id IS NOT NULL AND id NOT IN (
                    SELECT MIN(id) FROM tasks WHERE series_id IS NOT NULL GROUP BY series_id, date
                )
            );
            DELETE FROM task_time_entries WHERE task_id IN (
                SELECT id FROM tasks WHERE series_id IS NOT NULL AND id NOT IN (
                    SELECT MIN(id) FROM tasks WHERE series_id IS NOT NULL GROUP BY series_id, date
                )
            );
            DELETE FROM tasks WHERE series_id IS NOT NULL AND id NOT IN (
                SELECT MIN(id) FROM tasks WHERE series_id IS NOT NULL GROUP BY series_id, date
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_series_date ON tasks (series_id, date);",
            kind: MigrationKind::Up,
        },
    ];

    #[tauri::command]
    fn show_main_window(app: tauri::AppHandle) {
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.show();
            let _ = w.set_focus();
        }
        if let Some(popup) = app.get_webview_window("tray-popup") {
            let _ = popup.hide();
        }
        if let Some(ctx) = app.get_webview_window("tray-context") {
            let _ = ctx.hide();
        }
    }

    #[tauri::command]
    fn quit_app(app: tauri::AppHandle) {
        app.exit(0);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().args(vec!["--autolaunch"]).build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:atomic.db", migrations)
                .build(),
        )
        .setup(|app| {
            tray::setup_tray(app)?;
            let is_autolaunch = std::env::args().any(|a| a == "--autolaunch");
            if !is_autolaunch {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.restore_state(
                        StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED,
                    );
                    let _ = w.show();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    let _ = window.hide();
                    api.prevent_close();
                }
                tauri::WindowEvent::Focused(false)
                    if matches!(window.label(), "tray-popup" | "tray-context") =>
                {
                    let _ = window.hide();
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![show_main_window, quit_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
