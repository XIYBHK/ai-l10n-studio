/**
 * 翻译任务管理器
 *
 * 提供全局的翻译任务状态管理和取消功能
 */

use parking_lot::Mutex;
use std::sync::Arc;
use std::collections::HashMap;

/// 翻译任务 ID 类型
pub type TaskId = u64;

/// 全局任务管理器
static TASK_MANAGER: once_cell::sync::Lazy<TaskManager> =
    once_cell::sync::Lazy::new(TaskManager::new);

/// 获取全局任务管理器
pub fn get_task_manager() -> &'static TaskManager {
    &TASK_MANAGER
}

/// 翻译任务管理器
pub struct TaskManager {
    /// 当前活跃的翻译任务
    tasks: Mutex<HashMap<TaskId, Arc<tokio_util::sync::CancellationToken>>>,
    /// 任务 ID 计数器
    next_id: Mutex<TaskId>,
}

impl TaskManager {
    pub fn new() -> Self {
        Self {
            tasks: Mutex::new(HashMap::new()),
            next_id: Mutex::new(1),
        }
    }

    /// 创建一个新的翻译任务
    pub fn create_task(&self) -> TaskId {
        let mut id_guard = self.next_id.lock();
        let id = *id_guard;
        *id_guard += 1;

        let token = Arc::new(tokio_util::sync::CancellationToken::new());

        let mut tasks = self.tasks.lock();
        tasks.insert(id, token);

        crate::app_log!("[任务管理器] 创建翻译任务 #{}", id);
        id
    }

    /// 完成一个翻译任务
    pub fn complete_task(&self, id: TaskId) {
        let mut tasks = self.tasks.lock();
        tasks.remove(&id);
        crate::app_log!("[任务管理器] 完成翻译任务 #{}", id);
    }

    /// 取消一个翻译任务
    pub fn cancel_task(&self, id: TaskId) -> bool {
        let mut tasks = self.tasks.lock();
        if let Some(token) = tasks.remove(&id) {
            token.cancel();
            crate::app_log!("[任务管理器] 取消翻译任务 #{}", id);
            true
        } else {
            crate::app_log!("[任务管理器] 任务 #{} 不存在或已完成", id);
            false
        }
    }

    /// 取消所有活跃的翻译任务
    pub fn cancel_all_tasks(&self) -> usize {
        let mut tasks = self.tasks.lock();
        let count = tasks.len();
        for (id, token) in tasks.drain() {
            token.cancel();
            crate::app_log!("[任务管理器] 取消翻译任务 #{}", id);
        }
        crate::app_log!("[任务管理器] 取消了 {} 个翻译任务", count);
        count
    }

    /// 检查任务是否被取消
    pub fn is_task_cancelled(&self, id: TaskId) -> bool {
        let tasks = self.tasks.lock();
        tasks.get(&id)
            .map(|token| token.is_cancelled())
            .unwrap_or(true)
    }

    /// 获取任务的取消令牌
    pub fn get_task_token(&self, id: TaskId) -> Option<Arc<tokio_util::sync::CancellationToken>> {
        let tasks = self.tasks.lock();
        tasks.get(&id).cloned()
    }

    /// 获取当前活跃任务数量
    pub fn active_task_count(&self) -> usize {
        self.tasks.lock().len()
    }
}

/// 翻译任务守卫，自动管理任务生命周期
pub struct TaskGuard {
    id: TaskId,
}

impl TaskGuard {
    pub fn new() -> Self {
        let id = get_task_manager().create_task();
        Self { id }
    }

    pub fn id(&self) -> TaskId {
        self.id
    }

    /// 获取取消令牌
    pub fn token(&self) -> Arc<tokio_util::sync::CancellationToken> {
        get_task_manager()
            .get_task_token(self.id)
            .expect("任务令牌不存在")
    }

    /// 检查是否被取消
    pub fn is_cancelled(&self) -> bool {
        get_task_manager().is_task_cancelled(self.id)
    }
}

impl Drop for TaskGuard {
    fn drop(&mut self) {
        get_task_manager().complete_task(self.id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_creation() {
        let manager = TaskManager::new();
        let id = manager.create_task();
        assert!(id >= 1);
        assert_eq!(manager.active_task_count(), 1);
    }

    #[test]
    fn test_task_completion() {
        let manager = TaskManager::new();
        let id = manager.create_task();
        assert_eq!(manager.active_task_count(), 1);
        manager.complete_task(id);
        assert_eq!(manager.active_task_count(), 0);
    }

    #[test]
    fn test_task_cancellation() {
        let manager = TaskManager::new();
        let id = manager.create_task();
        let token = manager.get_task_token(id).unwrap();

        assert!(!token.is_cancelled());
        assert!(manager.cancel_task(id));
        assert!(token.is_cancelled());
        assert_eq!(manager.active_task_count(), 0);
    }

    #[test]
    fn test_cancel_all() {
        let manager = TaskManager::new();
        manager.create_task();
        manager.create_task();
        manager.create_task();

        assert_eq!(manager.active_task_count(), 3);
        assert_eq!(manager.cancel_all_tasks(), 3);
        assert_eq!(manager.active_task_count(), 0);
    }
}
