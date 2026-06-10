// 같은 파일이 서로 다른 URI 인코딩으로 들어와도 한 문서로 취급해야 한다.
// VSCode 클라이언트는 경로의 '@'를 %40으로 인코딩하지만 Node pathToFileURL은
// 그대로 두기 때문에, 키를 정규화하지 않으면 워크스페이스 인덱싱과 didOpen이
// 같은 파일을 이중 등록해 모든 타입이 "자기 자신과 중복" 오진단된다.

import { describe, it, expect } from 'vitest';
import { ProjectModel } from '../project-model.js';
import { normalizeUri } from '../uri-utils.js';

// VSCode(didOpen) 형식과 Node pathToFileURL(워크스페이스 인덱싱) 형식
const ENCODED_URI = 'file:///Users/dev/%40src/project/sample.qtn';
const PLAIN_URI = 'file:///Users/dev/@src/project/sample.qtn';

const SOURCE = `
enum WeaponType { Sword, Bow, Staff, Dagger }

component Player {
  WeaponType Weapon;
}
`;

describe('normalizeUri', () => {
  it('unifies percent-encoded and literal forms of the same file URI', () => {
    expect(normalizeUri(ENCODED_URI)).toBe(normalizeUri(PLAIN_URI));
  });

  it('lowercases Windows drive letters', () => {
    expect(normalizeUri('file:///C:/project/a.qtn')).toBe(
      normalizeUri('file:///c%3A/project/a.qtn'),
    );
  });

  it('leaves non-file URIs untouched', () => {
    expect(normalizeUri('test://a.qtn')).toBe('test://a.qtn');
    expect(normalizeUri('untitled:Untitled-1')).toBe('untitled:Untitled-1');
  });

  it('keeps file URIs it cannot convert as-is instead of throwing', () => {
    // POSIX에서 호스트가 있는 file URI는 fileURLToPath가 던진다
    expect(normalizeUri('file://some-host/share/a.qtn')).toBe('file://some-host/share/a.qtn');
  });
});

describe('ProjectModel URI key normalization', () => {
  it('treats encoded and plain URI forms as one document', () => {
    const projectModel = new ProjectModel();
    projectModel.updateDocument(PLAIN_URI, SOURCE); // 워크스페이스 인덱싱
    projectModel.updateDocument(ENCODED_URI, SOURCE); // didOpen

    expect(projectModel.getAllDocuments().size).toBe(1);
    expect(projectModel.getDocument(PLAIN_URI)).toBeDefined();
    expect(projectModel.getDocument(ENCODED_URI)).toBeDefined();
  });

  it('removes the document regardless of which URI form is used', () => {
    const projectModel = new ProjectModel();
    projectModel.updateDocument(PLAIN_URI, SOURCE);
    projectModel.removeDocument(ENCODED_URI);

    expect(projectModel.getAllDocuments().size).toBe(0);
  });
});

describe('symbol identity across URI forms', () => {
  it('does not double-count definitions when the same file arrives in both forms', () => {
    const projectModel = new ProjectModel();
    projectModel.updateDocument(PLAIN_URI, SOURCE); // 워크스페이스 인덱싱
    projectModel.updateDocument(ENCODED_URI, SOURCE); // didOpen

    const weaponTypeDefs = [...projectModel.getAllDocuments().values()]
      .flatMap((doc) => doc.definitions)
      .filter((def) => def.name === 'WeaponType');
    expect(weaponTypeDefs).toHaveLength(1);
  });

  it('keeps definitions from genuinely distinct files separate', () => {
    const projectModel = new ProjectModel();
    projectModel.updateDocument('file:///Users/dev/%40src/project/a.qtn', SOURCE);
    projectModel.updateDocument('file:///Users/dev/@src/project/b.qtn', SOURCE);

    expect(projectModel.getAllDocuments().size).toBe(2);
  });
});
