///! 进度更新节流器
///! 用于优化频繁的进度更新，避免UI卡顿
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

/// 进度节流器
///
/// 限制进度更新的频率，避免过于频繁的UI更新导致性能问题
pub struct ProgressThrottler {
    /// 最小更新间隔（毫秒）
    min_interval_ms: u64,
    /// 上次更新时间戳
    last_update: Arc<AtomicU64>,
}

impl ProgressThrottler {
    /// 创建新的进度节流器
    ///
    /// # 参数
    /// * `min_interval_ms` - 最小更新间隔（毫秒），默认100ms
    pub fn new(min_interval_ms: u64) -> Self {
        Self {
            min_interval_ms,
            last_update: Arc::new(AtomicU64::new(0)),
        }
    }

    /// 使用默认配置创建（100ms间隔）
    pub fn default() -> Self {
        Self::new(100)
    }

    /// 检查是否应该更新进度
    ///
    /// # 返回
    /// * `true` - 应该更新，距离上次更新已超过最小间隔
    /// * `false` - 不应该更新，距离上次更新时间过短
    pub fn should_update(&self) -> bool {
        let now = Self::current_timestamp_ms();
        let last = self.last_update.load(Ordering::Relaxed);

        if now >= last + self.min_interval_ms {
            self.last_update.store(now, Ordering::Relaxed);
            true
        } else {
            false
        }
    }

    /// 强制更新（忽略节流限制）
    /// 用于关键的进度点，如开始和完成
    pub fn force_update(&self) {
        let now = Self::current_timestamp_ms();
        self.last_update.store(now, Ordering::Relaxed);
    }

    /// 重置节流器
    pub fn reset(&self) {
        self.last_update.store(0, Ordering::Relaxed);
    }

    /// 获取当前时间戳（毫秒）
    fn current_timestamp_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    }

    /// 获取距离上次更新的时间（毫秒）
    pub fn elapsed_since_last_update(&self) -> u64 {
        let now = Self::current_timestamp_ms();
        let last = self.last_update.load(Ordering::Relaxed);
        now.saturating_sub(last)
    }
}

/// 批量进度跟踪器
///
/// 用于跟踪批量操作的进度，并智能决定何时发送进度更新
pub struct BatchProgressTracker {
    /// 总数
    total: usize,
    /// 当前进度
    current: usize,
    /// 节流器
    throttler: ProgressThrottler,
    /// 强制更新的百分比点 (如: [0, 25, 50, 75, 100])
    checkpoint_percentages: Vec<u8>,
}

impl BatchProgressTracker {
    /// 创建新的批量进度跟踪器
    pub fn new(total: usize) -> Self {
        Self {
            total,
            current: 0,
            throttler: ProgressThrottler::default(),
            checkpoint_percentages: vec![0, 25, 50, 75, 100],
        }
    }

    /// 创建带自定义节流间隔的跟踪器
    pub fn with_interval(total: usize, interval_ms: u64) -> Self {
        Self {
            total,
            current: 0,
            throttler: ProgressThrottler::new(interval_ms),
            checkpoint_percentages: vec![0, 25, 50, 75, 100],
        }
    }

    /// 增加进度
    ///
    /// # 返回
    /// `true` 表示应该发送进度更新
    pub fn increment(&mut self) -> bool {
        self.current += 1;
        self.should_emit()
    }

    /// 设置当前进度
    ///
    /// # 返回
    /// `true` 表示应该发送进度更新
    pub fn set_progress(&mut self, current: usize) -> bool {
        self.current = current;
        self.should_emit()
    }

    /// 检查是否应该发送进度更新
    fn should_emit(&self) -> bool {
        // 总是发送开始和完成的进度
        if self.current == 0 || self.current == self.total {
            return true;
        }

        // 检查是否达到关键百分比点
        let percentage = self.percentage();
        if self.checkpoint_percentages.contains(&(percentage as u8)) {
            return true;
        }

        // 使用节流器判断
        self.throttler.should_update()
    }

    /// 获取当前进度百分比
    pub fn percentage(&self) -> f64 {
        if self.total == 0 {
            return 0.0;
        }
        (self.current as f64 / self.total as f64) * 100.0
    }

    /// 获取当前进度
    pub fn current(&self) -> usize {
        self.current
    }

    /// 获取总数
    pub fn total(&self) -> usize {
        self.total
    }

    /// 强制发送进度更新
    pub fn force_emit(&mut self) {
        self.throttler.force_update();
    }

    /// 重置进度
    pub fn reset(&mut self) {
        self.current = 0;
        self.throttler.reset();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;
    use std::time::Duration;

    #[test]
    fn test_throttler_basic() {
        let throttler = ProgressThrottler::new(50); // 50ms间隔

        // 第一次应该允许
        assert!(throttler.should_update());

        // 立即再次调用应该被拒绝
        assert!(!throttler.should_update());

        // 等待足够时间后应该允许
        sleep(Duration::from_millis(60));
        assert!(throttler.should_update());
    }

    #[test]
    fn test_throttler_force_update() {
        let throttler = ProgressThrottler::new(100);

        throttler.should_update(); // 消耗第一次

        // 强制更新不受节流限制
        throttler.force_update();

        // 但是下次正常更新仍然受节流限制
        assert!(!throttler.should_update());
    }

    #[test]
    fn test_batch_tracker_checkpoints() {
        let mut tracker = BatchProgressTracker::new(100);

        // 起始点应该emit
        assert!(tracker.should_emit());

        // 25%应该emit
        tracker.set_progress(25);
        assert!(tracker.should_emit());

        // 50%应该emit
        tracker.set_progress(50);
        assert!(tracker.should_emit());

        // 100%应该emit
        tracker.set_progress(100);
        assert!(tracker.should_emit());
    }

    #[test]
    fn test_batch_tracker_percentage() {
        let mut tracker = BatchProgressTracker::new(200);

        assert_eq!(tracker.percentage(), 0.0);

        tracker.set_progress(50);
        assert_eq!(tracker.percentage(), 25.0);

        tracker.set_progress(100);
        assert_eq!(tracker.percentage(), 50.0);

        tracker.set_progress(200);
        assert_eq!(tracker.percentage(), 100.0);
    }

    #[test]
    fn test_batch_tracker_increment() {
        let mut tracker = BatchProgressTracker::new(10);

        for _ in 0..5 {
            tracker.increment();
        }

        assert_eq!(tracker.current(), 5);
        assert_eq!(tracker.percentage(), 50.0);
    }
}
