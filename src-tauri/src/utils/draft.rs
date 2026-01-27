/**
 * Draft 配置管理模式
 *
 * 参考 clash-verge-rev 的设计，提供：
 * - 原子性配置更新（要么全部成功，要么全部回滚）
 * - 草稿模式（修改不会立即生效）
 * - 并发安全（多个请求同时修改不会冲突）
 *
 * 设计原理：
 * - 使用 RwLock 保证线程安全
 * - 维护两份数据：committed（已提交）和 draft（草稿）
 * - 所有修改先在草稿上进行，确认后再提交到正式数据
 */
use parking_lot::{
    MappedRwLockReadGuard, MappedRwLockWriteGuard, RwLock, RwLockReadGuard,
    RwLockUpgradableReadGuard, RwLockWriteGuard,
};
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct Draft<T: Clone> {
    /// 内部数据：(committed_data, draft_data)
    inner: Arc<RwLock<(T, Option<T>)>>,
}

impl<T: Clone> From<T> for Draft<T> {
    fn from(data: T) -> Self {
        Self {
            inner: Arc::new(RwLock::new((data, None))),
        }
    }
}

impl<T: Clone> Draft<Box<T>> {
    /// 获取正式数据的可写引用（直接修改已提交的数据）
    ///
    /// ⚠️ 注意：直接修改正式数据会跳过草稿机制，请谨慎使用
    pub fn data_mut(&self) -> MappedRwLockWriteGuard<'_, Box<T>> {
        RwLockWriteGuard::map(self.inner.write(), |inner| &mut inner.0)
    }

    /// 获取正式数据的只读引用（不包含草稿）
    pub fn data_ref(&self) -> MappedRwLockReadGuard<'_, Box<T>> {
        RwLockReadGuard::map(self.inner.read(), |inner| &inner.0)
    }

    /// 获取或创建草稿，返回可写引用
    ///
    /// 如果草稿不存在，会自动从正式数据克隆一份
    /// 这是推荐的修改方式：所有修改在草稿上进行，最后调用 apply() 提交
    pub fn draft_mut(&self) -> MappedRwLockWriteGuard<'_, Box<T>> {
        let guard = self.inner.upgradable_read();

        if guard.1.is_none() {
            let mut guard = RwLockUpgradableReadGuard::upgrade(guard);
            guard.1 = Some(guard.0.clone());
            #[allow(clippy::unwrap_used)]
            return RwLockWriteGuard::map(guard, |inner| inner.1.as_mut().unwrap());
        }

        #[allow(clippy::unwrap_used)]
        RwLockWriteGuard::map(RwLockUpgradableReadGuard::upgrade(guard), |inner| {
            inner.1.as_mut().unwrap()
        })
    }

    /// 获取最新数据的只读引用（优先返回草稿，没有草稿则返回正式数据）
    ///
    /// 这是获取"当前有效配置"的推荐方式
    pub fn latest_ref(&self) -> MappedRwLockReadGuard<'_, Box<T>> {
        RwLockReadGuard::map(self.inner.read(), |inner| {
            inner.1.as_ref().unwrap_or(&inner.0)
        })
    }

    /// 提交草稿，将草稿数据应用到正式数据
    ///
    /// 返回：
    /// - Some(old_data): 成功提交，返回旧的正式数据
    /// - None: 没有草稿需要提交
    pub fn apply(&self) -> Option<Box<T>> {
        let mut inner = self.inner.write();
        inner
            .1
            .take()
            .map(|draft| std::mem::replace(&mut inner.0, draft))
    }

    /// 丢弃草稿，放弃所有未提交的修改
    ///
    /// 返回：
    /// - Some(draft): 成功丢弃，返回被丢弃的草稿数据
    /// - None: 没有草稿需要丢弃
    pub fn discard(&self) -> Option<Box<T>> {
        self.inner.write().1.take()
    }

    /// 检查是否有未提交的草稿
    pub fn has_draft(&self) -> bool {
        self.inner.read().1.is_some()
    }

    /// 克隆当前的正式数据（不包含草稿）
    pub fn clone_data(&self) -> Box<T> {
        self.data_ref().clone()
    }

    /// 克隆最新数据（包含草稿）
    pub fn clone_latest(&self) -> Box<T> {
        self.latest_ref().clone()
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[derive(Debug, Clone, PartialEq)]
    struct TestConfig {
        value: i32,
        name: String,
    }

    #[test]
    fn test_draft_basic() {
        let config = Box::new(TestConfig {
            value: 100,
            name: "initial".to_string(),
        });
        let draft = Draft::from(config);

        // 读取正式数据
        assert_eq!(draft.data_ref().value, 100);
        assert_eq!(draft.data_ref().name, "initial");

        // 创建草稿并修改
        {
            let mut d = draft.draft_mut();
            d.value = 200;
            d.name = "modified".to_string();
        }

        // 正式数据未变
        assert_eq!(draft.data_ref().value, 100);
        assert_eq!(draft.data_ref().name, "initial");

        // latest_ref 返回草稿
        assert_eq!(draft.latest_ref().value, 200);
        assert_eq!(draft.latest_ref().name, "modified");

        // 提交草稿
        let old = draft.apply();
        assert!(old.is_some());
        assert_eq!(old.unwrap().value, 100);

        // 正式数据已更新
        assert_eq!(draft.data_ref().value, 200);
        assert_eq!(draft.data_ref().name, "modified");

        // 没有草稿了
        assert!(!draft.has_draft());
    }

    #[test]
    #[allow(clippy::unwrap_used)]
    fn test_draft_discard() {
        let config = Box::new(TestConfig {
            value: 100,
            name: "initial".to_string(),
        });
        let draft = Draft::from(config);

        // 创建并修改草稿
        {
            let mut d = draft.draft_mut();
            d.value = 200;
        }

        assert!(draft.has_draft());

        // 丢弃草稿
        let discarded = draft.discard();
        assert!(discarded.is_some());
        assert_eq!(discarded.unwrap().value, 200);

        // 正式数据未变
        assert_eq!(draft.data_ref().value, 100);
        assert!(!draft.has_draft());
    }

    #[test]
    fn test_draft_multiple_apply() {
        let config = Box::new(TestConfig {
            value: 100,
            name: "initial".to_string(),
        });
        let draft = Draft::from(config);

        // 第一次修改
        draft.draft_mut().value = 200;
        draft.apply();

        // 第二次修改
        draft.draft_mut().value = 300;
        draft.apply();

        assert_eq!(draft.data_ref().value, 300);
    }
}
