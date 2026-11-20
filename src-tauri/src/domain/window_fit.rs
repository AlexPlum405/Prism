//! 窗口开窗尺寸的收敛规则。
//!
//! 配置里的尺寸是「理想尺寸」，不是「必然尺寸」：13 寸 Mac 的可用工作区
//! （已扣掉菜单栏与 Dock）只有约 1440×805，写死 1440×1000 会让窗口一开就
//! 顶出屏幕，标题栏跑到菜单栏后面，用户还得手动缩一次。
//!
//! 这里只做纯计算，取「理想尺寸」与「工作区 92%」的较小值；屏幕信息拿不到时
//! 保持理想尺寸，不猜。

/// 窗口最多占屏幕可用区的比例。留一点边，避免窗口紧贴四周边缘。
pub const WINDOW_FIT_RATIO: f64 = 0.92;

/// 把理想尺寸收敛到屏幕可用区内，不放大。
///
/// `work_area` 为 `None`（拿不到显示器信息）或数值异常时，原样返回理想尺寸。
pub fn fit_size(preferred: (f64, f64), work_area: Option<(f64, f64)>) -> (f64, f64) {
    match work_area {
        Some((area_width, area_height))
            if area_width.is_finite()
                && area_height.is_finite()
                && area_width > 0.0
                && area_height > 0.0 =>
        {
            (
                preferred.0.min(area_width * WINDOW_FIT_RATIO).round(),
                preferred.1.min(area_height * WINDOW_FIT_RATIO).round(),
            )
        }
        _ => (preferred.0.round(), preferred.1.round()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 13 寸 MacBook Air：1440×900 面板，扣掉菜单栏与 Dock 后约 1440×805。
    #[test]
    fn shrinks_height_on_thirteen_inch_screen() {
        assert_eq!(fit_size((1240.0, 840.0), Some((1440.0, 805.0))), (1240.0, 741.0));
    }

    /// 16 寸 MacBook Pro：可用区约 1728×1020，理想尺寸完整放得下。
    #[test]
    fn keeps_preferred_size_on_large_screen() {
        assert_eq!(fit_size((1240.0, 840.0), Some((1728.0, 1020.0))), (1240.0, 840.0));
    }

    /// 从不放大：小屏上理想尺寸本来就小于 92%，不该被撑大。
    #[test]
    fn never_upscales() {
        assert_eq!(fit_size((1000.0, 700.0), Some((2560.0, 1400.0))), (1000.0, 700.0));
    }

    #[test]
    fn keeps_preferred_size_without_monitor() {
        assert_eq!(fit_size((1240.0, 840.0), None), (1240.0, 840.0));
    }

    /// 显示器信息异常（0 或 NaN）时不能算出一个 0 尺寸的窗口。
    #[test]
    fn ignores_broken_work_area() {
        assert_eq!(fit_size((1240.0, 840.0), Some((0.0, 0.0))), (1240.0, 840.0));
        assert_eq!(fit_size((1240.0, 840.0), Some((f64::NAN, 900.0))), (1240.0, 840.0));
    }
}
