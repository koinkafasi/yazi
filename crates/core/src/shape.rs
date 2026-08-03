use serde::{Deserialize, Serialize};

pub const MAX_VERTS: usize = 12;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum Shape {
    #[default]
    Circle,
    Square,
    Triangle,
    Diamond,
    Star,
    Spark,
    Hexagon,
}

/// Fixed-capacity vertex buffer so emission never allocates.
pub struct Verts {
    pub points: [(f32, f32); MAX_VERTS],
    pub len: usize,
}

impl Verts {
    pub fn as_slice(&self) -> &[(f32, f32)] {
        &self.points[..self.len]
    }
}

impl Shape {
    pub fn build(self, size: f32) -> Verts {
        let mut verts = Verts {
            points: [(0.0, 0.0); MAX_VERTS],
            len: 0,
        };
        let r = size * 0.5;
        let push = |v: &mut Verts, p: (f32, f32)| {
            v.points[v.len] = p;
            v.len += 1;
        };
        match self {
            Shape::Circle => {
                let n = 8;
                for i in 0..n {
                    let a = (i as f32 / n as f32) * std::f32::consts::TAU;
                    push(&mut verts, (a.cos() * r, a.sin() * r));
                }
            }
            Shape::Square => {
                let s = r * 0.9;
                push(&mut verts, (-s, -s));
                push(&mut verts, (s, -s));
                push(&mut verts, (s, s));
                push(&mut verts, (-s, s));
            }
            Shape::Triangle => {
                for i in 0..3 {
                    let a = (i as f32 / 3.0) * std::f32::consts::TAU - std::f32::consts::FRAC_PI_2;
                    push(&mut verts, (a.cos() * r, a.sin() * r));
                }
            }
            Shape::Diamond => {
                push(&mut verts, (0.0, -r));
                push(&mut verts, (r, 0.0));
                push(&mut verts, (0.0, r));
                push(&mut verts, (-r, 0.0));
            }
            Shape::Star => {
                let outer = r;
                let inner = r * 0.4;
                for i in 0..10 {
                    let a = (i as f32 / 10.0) * std::f32::consts::TAU - std::f32::consts::FRAC_PI_2;
                    let rad = if i % 2 == 0 { outer } else { inner };
                    push(&mut verts, (a.cos() * rad, a.sin() * rad));
                }
            }
            Shape::Spark => {
                for _ in 0..4 {
                    let a = fastrand::f32() * std::f32::consts::TAU;
                    let len = r * (0.3 + fastrand::f32() * 0.7);
                    push(&mut verts, (0.0, 0.0));
                    push(&mut verts, (a.cos() * len, a.sin() * len));
                }
            }
            Shape::Hexagon => {
                for i in 0..6 {
                    let a = (i as f32 / 6.0) * std::f32::consts::TAU;
                    push(&mut verts, (a.cos() * r, a.sin() * r));
                }
            }
        }
        verts
    }
}
