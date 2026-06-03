mod tray;

use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

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
    ];

    tauri::Builder::default()
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
                    let _ = w.show();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
