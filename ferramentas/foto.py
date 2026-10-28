# Gera a foto do capítulo Sobre (assets/foto/) a partir de uma foto sua:
#   python3 ferramentas/foto.py foto.heic     foto do iPhone: o fundo sai pelo mapa de profundidade que vem junto
#   python3 ferramentas/foto.py recorte.png   recorte já sem fundo (no app Fotos: toque e segure em você > Compartilhar)
# Precisa de: python3 -m pip install pillow numpy pillow-heif
#
# Saída (WebP, sem nenhum metadado da foto original: nada de EXIF nem localização):
#   retrato.webp      960 x 1200, a foto com o fundo, da cintura para cima, para o card do capítulo Sobre
#   retrato-640.webp  640 x 800, a mesma para o celular
#   eu-640.webp       o recorte sem fundo; o terminal desenha o comando foto a partir dele
#   rosto.webp        o rosto, quadrado e sem fundo, para o ícone ao lado do e-mail
import io
import os
import sys

import numpy as np
from PIL import Image, ImageCms, ImageFilter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, 'assets', 'foto')
PROPORCAO = 0.65   # largura / altura do recorte final (da cabeça até o meio da coxa)


def caixa(a, r):
    """Média numa janela (2r+1) x (2r+1), por soma acumulada."""
    c = np.cumsum(np.cumsum(np.pad(a, ((r + 1, r), (r + 1, r)), mode='edge'), 0), 1)
    return (c[2 * r + 1:, 2 * r + 1:] - c[:-2 * r - 1, 2 * r + 1:] - c[2 * r + 1:, :-2 * r - 1] + c[:-2 * r - 1, :-2 * r - 1]) / (2 * r + 1) ** 2


def filtro_guiado(guia, p, r, eps):
    """Ajusta a máscara p às bordas da imagem guia (He et al.): o contorno segue o cabelo e a roupa."""
    mi, mp = caixa(guia, r), caixa(p, r)
    a = (caixa(guia * p, r) - mi * mp) / (caixa(guia * guia, r) - mi * mi + eps)
    b = mp - a * mi
    return caixa(a, r) * guia + caixa(b, r)


def em_srgb(img):
    icc = img.info.get('icc_profile')
    if icc:
        img = ImageCms.profileToProfile(img, ImageCms.ImageCmsProfile(io.BytesIO(icc)), ImageCms.createProfile('sRGB'), outputMode='RGB')
    return img.convert('RGB')


def de_heic(caminho):
    import pillow_heif
    heif = pillow_heif.open_heif(caminho)
    foto = em_srgb(heif[0].to_pillow())
    prof = heif[0].info.get('depth_images') or []
    if not prof:
        sys.exit('Esta foto não tem mapa de profundidade. Use um recorte sem fundo (PNG).')
    w, h = foto.size
    d = np.asarray(prof[0].to_pillow().convert('L').resize((w, h), Image.BICUBIC), np.float32) / 255
    # O que está bem mais perto que o fundo é a pessoa.
    bruta = np.clip((d - 0.62) / 0.12, 0, 1)
    # Contorno fino na metade da resolução, guiado pela própria foto.
    m = Image.fromarray((bruta * 255).astype(np.uint8))
    meia = (w // 2, h // 2)
    g = np.asarray(foto.resize(meia, Image.LANCZOS).convert('L'), np.float32) / 255
    p = np.asarray(m.resize(meia, Image.BILINEAR), np.float32) / 255
    a = np.clip((filtro_guiado(g, p, 10, 1e-3) - 0.58) / 0.3, 0, 1)
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32) / 255
    # O filtro fecha vãos estreitos (entre o braço e o corpo); o mapa bruto, só um pouco alargado, reabre.
    perto = Image.fromarray(((bruta > 0.5) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(17)).filter(ImageFilter.GaussianBlur(3))
    a = np.minimum(a, np.asarray(perto, np.float32) / 255)
    # Onde o filtro avançou sobre o fundo, o que tiver a cor do fundo em volta da pessoa volta a ser fundo.
    pessoa = bruta > 0.5
    anel = ~pessoa & (np.asarray(Image.fromarray((pessoa * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(61)), np.uint8) > 127)
    c = np.asarray(foto, np.float32)
    fundo = np.median(c[anel], axis=0)
    dist = np.sqrt(((c - fundo) ** 2).sum(-1))
    a = np.where(~pessoa, a * np.clip((dist - 40) / 40, 0, 1), a)
    # Perto da borda, o azul claro do corredor que o mapa de profundidade juntou à pessoa também sai
    # (a roupa e a pele são quentes; a calça, escura demais para entrar aqui).
    borda = pessoa & (np.asarray(Image.fromarray((pessoa * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(41)), np.uint8) < 128)
    azul = (c[..., 2] - c[..., 0] > 12) & (c.mean(-1) > 150)
    a = np.where(borda & azul, 0, a)
    alfa = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
    return foto, np.asarray(alfa, np.float32) / 255


def de_png(caminho):
    img = Image.open(caminho).convert('RGBA')
    rgb = img.convert('RGB')
    if Image.open(caminho).info.get('icc_profile'):
        rgb.info['icc_profile'] = Image.open(caminho).info['icc_profile']
    return em_srgb(rgb), np.asarray(img.getchannel('A'), np.float32) / 255


def limpar_borda(foto, alfa):
    """Tira a cor do fundo que vaza na borda (halo claro): ali a cor vem do interior mais próximo."""
    c = np.asarray(foto, np.float32)
    dentro = (alfa > 0.97).astype(np.float32)
    soma = np.stack([caixa(c[..., k] * dentro, 9) for k in range(3)], -1)
    peso = caixa(dentro, 9)[..., None]
    interior = np.where(peso > 1e-3, soma / np.maximum(peso, 1e-3), c)
    t = np.clip((0.97 - alfa) / 0.6, 0, 1)[..., None]
    return c * (1 - t) + interior * t


def enquadrar(alfa):
    """Caixa de recorte: a pessoa centrada, com folga, da cabeça até onde a proporção deixar."""
    ys, xs = np.nonzero(alfa > 0.5)
    h, w = alfa.shape
    x0, x1, y0 = xs.min(), xs.max(), ys.min()
    larg = int((x1 - x0) * 1.3)
    alt = int(larg / PROPORCAO)
    cx = (x0 + x1) // 2
    esq = max(0, min(w - larg, cx - larg // 2))
    topo = max(0, y0 - int(alt * 0.04))
    return esq, topo, esq + larg, min(h, topo + alt)


def retrato(foto, alfa):
    """Card do Sobre: a foto inteira, com o fundo, em 4:5, da cabeça até um pouco abaixo da cintura."""
    ys, xs = np.nonzero(alfa > 0.5)
    h, w = alfa.shape
    y0 = ys.min()
    alt = min(h - max(0, y0 - 1), int((ys.max() - y0) * 0.74))
    topo = max(0, y0 - int(alt * 0.07))
    alt = min(h - topo, alt)
    larg = min(w, int(alt * 0.8))
    alt = int(larg / 0.8)
    cx = int(np.median(xs[ys < y0 + alt * 0.5]))
    esq = max(0, min(w - larg, cx - larg // 2))
    return foto.crop((esq, topo, esq + larg, topo + alt))


def main():
    if len(sys.argv) != 2:
        sys.exit('uso: python3 ferramentas/foto.py <foto.heic | recorte.png>')
    caminho = sys.argv[1]
    with open(caminho, 'rb') as f:
        heic = f.read(12)[4:12] in (b'ftypheic', b'ftypheix', b'ftypmif1', b'ftypheif')
    if heic:
        foto, alfa = de_heic(caminho)
    else:
        foto, alfa = de_png(caminho)
    cor = limpar_borda(foto, alfa)
    # Altas luzes um pouco mais baixas: a camisa branca não estoura no fundo escuro.
    cor = np.where(cor > 200, 200 + (cor - 200) * 0.6, cor)
    caixa_ = enquadrar(alfa)
    eu = Image.fromarray(np.clip(cor, 0, 255).astype(np.uint8)).crop(caixa_)
    eu.putalpha(Image.fromarray((alfa * 255).astype(np.uint8)).crop(caixa_))
    os.makedirs(SAIDA, exist_ok=True)
    # O card leva as cores como saíram da câmera, com o fundo.
    card = retrato(foto, alfa)
    for largura, nome in ((960, 'retrato.webp'), (640, 'retrato-640.webp')):
        card.resize((largura, largura * 5 // 4), Image.LANCZOS).save(os.path.join(SAIDA, nome), quality=80, method=6)
    pequena = eu.resize((640, round(640 / PROPORCAO)), Image.LANCZOS)
    pequena.save(os.path.join(SAIDA, 'eu-640.webp'), quality=80, method=6)
    # Rosto: um quadrado no alto, centrado na cabeça (o meio do que é pessoa no primeiro sexto da altura).
    a_eu = np.asarray(pequena.getchannel('A'), np.float32) / 255
    topo = a_eu[: a_eu.shape[0] // 6]
    cx = int((topo.sum(0) * np.arange(topo.shape[1])).sum() / max(topo.sum(), 1))
    lado = int(pequena.width * 0.5)
    esq = max(0, min(pequena.width - lado, cx - lado // 2))
    pequena.crop((esq, 0, esq + lado, lado)).resize((192, 192), Image.LANCZOS).save(os.path.join(SAIDA, 'rosto.webp'), quality=82, method=6)
    for nome in ('retrato.webp', 'retrato-640.webp', 'eu-640.webp', 'rosto.webp'):
        f = os.path.join(SAIDA, nome)
        print(f'{os.path.relpath(f, RAIZ)}: {os.path.getsize(f) // 1024} KB')


if __name__ == '__main__':
    main()
